import type { Question } from "../../shared/types";

const CODE = "church-quiz:roomCode";
const TOKEN = "church-quiz:hostToken";
const VIEW = "church-quiz:hostView";

export type HostView = "admin" | "game";

export function loadHostView(): HostView {
  return localStorage.getItem(VIEW) === "admin" ? "admin" : "game";
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

const BANK = "church-quiz:bank";

export function saveLocalBank(title: string, questions: Question[]) {
  localStorage.setItem(BANK, JSON.stringify({ title, questions }));
}

export function loadLocalBank(): { title: string; questions: Question[] } | null {
  const raw = localStorage.getItem(BANK);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { title?: string; questions?: Question[] };
    if (!Array.isArray(data.questions) || data.questions.length !== 12) return null;
    return { title: data.title || "青年小組冰破", questions: data.questions };
  } catch {
    return null;
  }
}

export function clearLocalBank() {
  localStorage.removeItem(BANK);
}
