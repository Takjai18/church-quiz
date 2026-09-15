import { ASK_FOR_LABEL, categoryLabel, currentQuestion, roomCategories } from "../../shared/labels";
import type { PublicQuestion, PublicRoom, RoomState } from "../../shared/types";

export default function PromptCard({
  room,
  showAnswer,
}: {
  room: PublicRoom | RoomState;
  showAnswer?: boolean;
}) {
  const q = currentQuestion(room) as PublicQuestion | undefined;
  if (!q || !room.current || room.phase === "board" || room.phase === "lobby" || room.phase === "finished") {
    return null;
  }

  const ask = q.askFor ? ASK_FOR_LABEL[q.askFor] : null;

  return (
    <div className="prompt-card">
      <div className="prompt-meta">
        <span className={`pill cat-${q.category}`}>{categoryLabel(q.category, roomCategories(room))}</span>
        <span className="pill gold">{q.points} 分</span>
        {ask ? <span className="pill">{ask}</span> : null}
      </div>
      {q.imageUrl ? (
        <figure className="still">
          <img src={q.imageUrl} alt="韓劇截圖" />
          <figcaption>韓劇截圖</figcaption>
        </figure>
      ) : null}
      <p className="prompt-text">{q.prompt}</p>
      {showAnswer && room.answerRevealed && q.answer ? (
        <p className="prompt-answer">答案：{q.answer}</p>
      ) : null}
    </div>
  );
}
