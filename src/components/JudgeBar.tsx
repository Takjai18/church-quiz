import type { HostIntent, PublicRoom, RoomState } from "../../shared/types";

export default function JudgeBar({
  room,
  onIntent,
  compact,
}: {
  room: RoomState | PublicRoom;
  onIntent: (intent: HostIntent) => void;
  compact?: boolean;
}) {
  const size = compact ? "huge-btn" : "huge-btn stage-btn";
  return (
    <div className={`btn-grid judge-bar ${compact ? "" : "stage-judge"}`}>
      {room.phase === "primary" ? (
        <>
          <button className={`btn good ${size}`} type="button" onClick={() => onIntent({ type: "judgePrimary", correct: true })}>
            啱
          </button>
          <button className={`btn bad ${size}`} type="button" onClick={() => onIntent({ type: "judgePrimary", correct: false })}>
            錯
          </button>
        </>
      ) : null}
      {room.phase === "steal_offer" ? (
        <>
          <button className={`btn good ${size}`} type="button" onClick={() => onIntent({ type: "acceptSteal" })}>
            補答
          </button>
          <button className={`btn warn ${size}`} type="button" onClick={() => onIntent({ type: "declineSteal" })}>
            唔補答
          </button>
        </>
      ) : null}
      {room.phase === "steal" ? (
        <>
          <button className={`btn good ${size}`} type="button" onClick={() => onIntent({ type: "judgeSteal", correct: true })}>
            補答啱
          </button>
          <button className={`btn bad ${size}`} type="button" onClick={() => onIntent({ type: "judgeSteal", correct: false })}>
            補答錯
          </button>
        </>
      ) : null}
      {room.phase === "reveal" ? (
        <button className={`btn primary ${size}`} type="button" onClick={() => onIntent({ type: "continueReveal" })}>
          繼續
        </button>
      ) : null}
      {room.phase === "board" ? (
        <p className="judge-hint">撳棋盤揀題</p>
      ) : null}
    </div>
  );
}
