import { DEFAULT_CATEGORIES, type AskFor, type Category, type CategoryDef, type PublicRoom, type RoomState, type TeamId } from "./types";

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  DEFAULT_CATEGORIES.map((c) => [c.id, c.label]),
);

export function categoryLabel(id: Category, extras?: CategoryDef[]): string {
  const hit = extras?.find((c) => c.id === id);
  if (hit) return hit.label;
  return CATEGORY_LABEL[id] || id;
}

export function roomCategories(room: PublicRoom | RoomState): CategoryDef[] {
  if (room.categories?.length) return room.categories;
  const ids: Category[] = [];
  for (const cell of room.cells) {
    if (!ids.includes(cell.category)) ids.push(cell.category);
  }
  return ids.map((id) => ({ id, label: categoryLabel(id) }));
}

export function slugCategory(label: string): string {
  const t = label.trim();
  const known = DEFAULT_CATEGORIES.find((c) => c.label === t);
  if (known) return known.id;
  const extra: Record<string, string> = {
    詩歌: "hymn",
    聖詩: "hymn",
    歷史: "history",
    常識: "trivia",
    時事: "current",
  };
  if (extra[t]) return extra[t];
  const ascii = t
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  if (ascii.length >= 2) return ascii;
  let n = 0;
  for (const ch of t) n += ch.charCodeAt(0);
  return `c${n.toString(36)}`;
}

export const ASK_FOR_LABEL: Record<AskFor, string> = {
  title: "請答劇名",
  character: "請答角色名",
  song: "請答歌名",
  punchline: "請答包袱",
  text: "請作答",
};

export function opponent(id: TeamId): TeamId {
  return id === "a" ? "b" : "a";
}

export function glowTeam(room: RoomState | PublicRoom, id: TeamId): boolean {
  if (room.phase === "board" || room.phase === "primary") return room.turn === id;
  if (room.phase === "steal_offer" || room.phase === "steal") return opponent(room.turn) === id;
  return false;
}

export function teamName(room: RoomState | PublicRoom, id: TeamId): string {
  return room.teams[id].name;
}

export function usedCount(room: RoomState | PublicRoom): number {
  return room.cells.filter((c) => c.used).length;
}

export function winnerId(room: RoomState | PublicRoom): TeamId | "tie" | null {
  if (room.phase !== "finished") return null;
  const a = room.teams.a.score;
  const b = room.teams.b.score;
  if (a === b) return "tie";
  return a > b ? "a" : "b";
}

export function statusLine(room: RoomState | PublicRoom): string {
  const t = teamName(room, room.turn);
  const o = teamName(room, opponent(room.turn));
  switch (room.phase) {
    case "lobby":
      return "等候主持開場";
    case "board":
      return `輪到【${t}】揀題`;
    case "primary":
      return `【${t}】作答中`;
    case "steal_offer":
      return `【${o}】要唔要補答？`;
    case "steal":
      return `【${o}】補答中`;
    case "reveal":
      return "答案揭示";
    case "finished": {
      const w = winnerId(room);
      if (w === "tie") return "打和！";
      if (w) return `【${teamName(room, w)}】勝出！`;
      return "完場";
    }
  }
}

export function currentQuestion<T extends { questions: { id: string }[]; current: { questionId: string } | null }>(
  room: T,
): T["questions"][number] | undefined {
  if (!room.current) return undefined;
  return room.questions.find((q) => q.id === room.current!.questionId);
}

export function cellKey(category: Category, points: number): string {
  return `${category}-${points}`;
}
