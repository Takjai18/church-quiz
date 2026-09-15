import type { AskFor, Category, Phase, PublicRoom, RoomState, TeamId } from "./types";

export const CATEGORY_LABEL: Record<Category, string> = {
  bible: "聖經",
  pop: "流行曲",
  kdrama: "韓劇",
  pun: "冷笑話",
};

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
