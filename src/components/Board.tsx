import { POINT_VALUES, type Category, type Points, type PublicRoom, type RoomState } from "../../shared/types";
import { categoryLabel, roomCategories } from "../../shared/labels";

export default function Board({
  room,
  interactive,
  onPick,
}: {
  room: PublicRoom | RoomState;
  interactive?: boolean;
  onPick?: (category: Category, points: Points) => void;
}) {
  const cats = roomCategories(room);
  const currentKey = room.current ? `${room.current.category}-${room.current.points}` : "";
  const canPick = interactive && room.phase === "board";

  return (
    <div
      className="board"
      role="grid"
      aria-label="題目板"
      style={{ gridTemplateColumns: `repeat(${Math.max(cats.length, 1)}, minmax(0, 1fr))` }}
    >
      {cats.map((c) => (
        <div key={c.id} className={`board-h cat-${c.id}`}>
          {c.label}
        </div>
      ))}
      {POINT_VALUES.map((points) =>
        cats.map((cat) => {
          const category = cat.id;
          const cell = room.cells.find((x) => x.category === category && x.points === points);
          const used = Boolean(cell?.used);
          const key = `${category}-${points}`;
          const active = key === currentKey;
          return (
            <button
              key={key}
              type="button"
              data-cell={key}
              className={`cell cat-${category} ${used ? "used" : ""} ${active ? "active" : ""}`}
              disabled={!canPick || used}
              onClick={() => canPick && !used && onPick?.(category, points)}
            >
              <span className="cell-pts">{points}</span>
              {used && !active ? <span className="cell-done">已用</span> : null}
            </button>
          );
        }),
      )}
    </div>
  );
}
