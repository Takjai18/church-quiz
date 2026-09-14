import type { PublicRoom, RoomState } from "../../shared/types";
import { opponent } from "../../shared/labels";

export default function Scoreboard({
  room,
  huge,
}: {
  room: PublicRoom | RoomState;
  huge?: boolean;
}) {
  const answering =
    room.phase === "primary" ? room.turn : room.phase === "steal" || room.phase === "steal_offer" ? opponent(room.turn) : null;
  const picking = room.phase === "board" ? room.turn : null;

  return (
    <div className={`scores ${huge ? "huge" : ""}`}>
      {(["a", "b"] as const).map((id) => {
        const team = room.teams[id];
        const negative = team.score < 0;
        const glow = answering === id || picking === id;
        return (
          <div key={id} className={`score-card team-${id} ${glow ? "glow" : ""}`}>
            <div className="score-name">{team.name}</div>
            <div className={`score-num ${negative ? "neg" : ""}`}>{team.score}</div>
          </div>
        );
      })}
    </div>
  );
}
