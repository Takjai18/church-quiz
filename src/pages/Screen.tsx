import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Board from "../components/Board";
import MuteButton from "../components/MuteButton";
import PromptCard from "../components/PromptCard";
import Timer from "../components/Timer";
import { getSocket } from "../lib/socket";
import { playSfx } from "../lib/sfx";
import { opponent, statusLine, winnerId } from "../../shared/labels";
import type { PublicRoom, TeamId } from "../../shared/types";

function glowTeam(room: PublicRoom, id: TeamId): boolean {
  if (room.phase === "board" || room.phase === "primary") return room.turn === id;
  if (room.phase === "steal_offer" || room.phase === "steal") return opponent(room.turn) === id;
  return false;
}

export default function Screen({ mode }: { mode: "tv" | "phone" }) {
  const { roomCode } = useParams();
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [error, setError] = useState("");
  const lastSfx = useRef(-1);

  useEffect(() => {
    const s = getSocket();
    const onState = (next: PublicRoom) => {
      setRoom(next);
      setError("");
      if (next.sfx && next.sfxId !== lastSfx.current) {
        lastSfx.current = next.sfxId;
        playSfx(next.sfx, next.sfxId);
      }
    };
    const onErr = (msg: string) => setError(msg);
    s.on("state", onState);
    s.on("errorMsg", onErr);
    const join = () => s.emit("join", { roomCode, role: mode === "tv" ? "display" : "play" });
    s.on("connect", join);
    join();
    return () => {
      s.off("state", onState);
      s.off("errorMsg", onErr);
      s.off("connect", join);
    };
  }, [roomCode, mode]);

  if (error) {
    return (
      <div className="page center">
        <p className="error">{error}</p>
        <Link to="/">返回</Link>
      </div>
    );
  }
  if (!room) {
    return (
      <div className="page center">
        <p>連線中…</p>
      </div>
    );
  }

  const timerTotal = room.phase === "steal_offer" ? 10 : 30;
  const w = winnerId(room);

  return (
    <div className={`page display-page ${mode}`}>
      <header className="display-top">
        <div className={`score-card team-a huge ${glowTeam(room, "a") ? "glow" : ""}`}>
          <div className="score-name">{room.teams.a.name}</div>
          <div className={`score-num ${room.teams.a.score < 0 ? "neg" : ""}`}>{room.teams.a.score}</div>
        </div>
        <div className="display-mid">
          <p className="eyebrow">{room.title}</p>
          <h1 className="status-line">{room.phase === "finished" ? "完場" : statusLine(room)}</h1>
          <p className="room-chip">房號 {room.code}</p>
          <MuteButton />
        </div>
        <div className={`score-card team-b huge ${glowTeam(room, "b") ? "glow" : ""}`}>
          <div className="score-name">{room.teams.b.name}</div>
          <div className={`score-num ${room.teams.b.score < 0 ? "neg" : ""}`}>{room.teams.b.score}</div>
        </div>
      </header>

      <div className={`display-body ${room.phase}`}>
        <Board room={room} />
        <div className="display-q">
          <Timer deadline={room.deadline} totalSec={timerTotal} />
          <PromptCard room={room} showAnswer={room.answerRevealed} />
          {room.phase === "finished" ? (
            <div className="finish-banner">
              {w === "tie" ? "打和！" : w ? `【${room.teams[w].name}】勝出！` : "完場"}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
