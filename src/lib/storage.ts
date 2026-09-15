const CODE = "church-quiz:roomCode";
const TOKEN = "church-quiz:hostToken";
const VIEW = "church-quiz:hostView";

export type HostView = "admin" | "game";

export function loadHostView(): HostView {
  return localStorage.getItem(VIEW) === "game" ? "game" : "admin";
}

export function saveHostView(view: HostView) {
  localStorage.setItem(VIEW, view);
}

export function saveHostSession(roomCode: string, hostToken: string) {
  localStorage.setItem(CODE, roomCode);
  localStorage.setItem(TOKEN, hostToken);
}

export function loadHostSession(): { roomCode: string; hostToken: string } | null {
  const roomCode = localStorage.getItem(CODE);
  const hostToken = localStorage.getItem(TOKEN);
  if (!roomCode || !hostToken) return null;
  return { roomCode, hostToken };
}

export function clearHostSession() {
  localStorage.removeItem(CODE);
  localStorage.removeItem(TOKEN);
}
