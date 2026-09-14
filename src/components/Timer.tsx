import { useEffect, useRef, useState } from "react";
import { playSfx } from "../lib/sfx";

export default function Timer({
  deadline,
  totalSec,
}: {
  deadline: number | null;
  totalSec: number;
}) {
  const [now, setNow] = useState(Date.now());
  const lastTick = useRef<number>(-1);

  useEffect(() => {
    if (!deadline) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [deadline]);

  const remain = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;

  useEffect(() => {
    if (remain === null) return;
    if (remain > 0 && remain <= 5 && lastTick.current !== remain) {
      lastTick.current = remain;
      playSfx("tick");
    }
  }, [remain]);

  if (remain === null) return null;
  const danger = remain <= 5;
  const pct = Math.max(0, Math.min(100, (remain / totalSec) * 100));

  return (
    <div className={`timer ${danger ? "danger" : ""}`} aria-live="polite">
      <div className="timer-num">{remain}</div>
      <div className="timer-bar">
        <div className="timer-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
