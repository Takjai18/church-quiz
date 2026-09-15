import type { Category, Points, PublicRoom, RoomState } from "../../shared/types";
import { glowTeam, statusLine, winnerId } from "../../shared/labels";
import Board from "./Board";
import PromptCard from "./PromptCard";
import Timer from "./Timer";
import type { ReactNode } from "react";

export default function Stage({
  room,
  interactive,
  onPick,
  showAnswer,
  footer,
  chrome,
}: {
  room: PublicRoom | RoomState;
  interactive?: boolean;
  onPick?: (category: Category, points: Points) => void;
  showAnswer?: boolean;
  footer?: ReactNode;
  chrome?: ReactNode;
}) {
  const timerTotal = room.phase === "steal_offer" ? 10 : 30;
  const w = winnerId(room);

  return (
    <>
      <header className="display-top">
        <div className={`score-card team-a huge ${glowTeam(room, "a") ? "glow" : ""}`}>
          <div className="score-name">{room.teams.a.name}</div>
          <div className={`score-num ${room.teams.a.score < 0 ? "neg" : ""}`}>{room.teams.a.score}</div>
        </div>
        <div className="display-mid">
          <p className="eyebrow">{room.title}</p>
          <h1 className="status-line">{room.phase === "finished" ? "完場" : statusLine(room)}</h1>
          <p className="room-chip">房號 {room.code}</p>
          {chrome}
        </div>
        <div className={`score-card team-b huge ${glowTeam(room, "b") ? "glow" : ""}`}>
          <div className="score-name">{room.teams.b.name}</div>
          <div className={`score-num ${room.teams.b.score < 0 ? "neg" : ""}`}>{room.teams.b.score}</div>
        </div>
      </header>

      <div className={`display-body ${room.phase}`}>
        <Board room={room} interactive={interactive} onPick={onPick} />
        <div className="display-q">
          <Timer deadline={room.deadline} totalSec={timerTotal} />
          <PromptCard room={room} showAnswer={showAnswer} />
          {room.phase === "finished" ? (
            <div className="finish-banner">
              {w === "tie" ? "打和！" : w ? `【${room.teams[w].name}】勝出！` : "完場"}
            </div>
          ) : null}
        </div>
      </div>
      {footer}
    </>
  );
}
