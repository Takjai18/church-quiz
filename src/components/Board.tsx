import type { Cell, PublicRoom, RoomState } from "../../shared/types";
import { roomCategories } from "../../shared/labels";

export default function Board({
  room,
  interactive,
  onPick,
}: {
  room: PublicRoom | RoomState;
  interactive?: boolean;
  onPick?: (cell: Cell) => void;
}) {
  const cats = roomCategories(room);
  const maxSlot = room.cells.reduce((n, c) => Math.max(n, (c.slot ?? 0) + 1), 0);
  const currentId = room.current?.cellId || (room.current ? `${room.current.category}-${room.current.points}` : "");
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
      {Array.from({ length: Math.max(maxSlot, 1) }, (_, slot) =>
        cats.map((cat) => {
          const cell = room.cells.find((x) => {
            const s = typeof x.slot === "number" ? x.slot : [10, 30, 50].indexOf(x.points);
            return x.category === cat.id && s === slot;
          });
          if (!cell) {
            return <div key={`${cat.id}-empty-${slot}`} className="cell empty" />;
          }
          const used = Boolean(cell.used);
          const key = cell.id || `${cell.category}-${cell.points}`;
          const active = key === currentId || (room.current?.category === cell.category && room.current?.points === cell.points && room.current?.slot == null);
          return (
            <button
              key={key}
              type="button"
              data-cell={`${cell.category}-${cell.points}`}
              data-cell-id={key}
              className={`cell cat-${cell.category} ${used ? "used" : ""} ${active ? "active" : ""}`}
              disabled={!canPick || used}
              onClick={() => canPick && !used && onPick?.(cell)}
            >
              <span className="cell-pts">{cell.points}</span>
              {used && !active ? <span className="cell-done">已用</span> : null}
            </button>
          );
        }),
      )}
    </div>
  );
}
