import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import MuteButton from "../components/MuteButton";
import Stage from "../components/Stage";
import { getSocket } from "../lib/socket";
import { playSfx } from "../lib/sfx";
import type { PublicRoom } from "../../shared/types";

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

  return (
    <div className={`page display-page ${mode}`}>
      <Stage room={room} showAnswer={room.answerRevealed} chrome={<MuteButton />} />
    </div>
  );
}
