export type Category = "bible" | "pop" | "kdrama" | "pun";
export type Points = 10 | 30 | 50;
export type Phase =
  | "lobby"
  | "board"
  | "primary"
  | "steal_offer"
  | "steal"
  | "reveal"
  | "finished";
export type TeamId = "a" | "b";
export type AskFor = "title" | "character" | "song" | "punchline" | "text";
export type Sfx = "pick" | "correct" | "wrong" | "finish";

export const CATEGORIES: Category[] = ["bible", "pop", "kdrama", "pun"];
export const POINT_VALUES: Points[] = [10, 30, 50];

export interface Question {
  id: string;
  category: Category;
  points: Points;
  prompt: string;
  answer: string;
  accept: string[];
  hostNote?: string;
  imageUrl?: string;
  askFor?: AskFor;
}

export interface PublicQuestion {
  id: string;
  category: Category;
  points: Points;
  prompt: string;
  imageUrl?: string;
  askFor?: AskFor;
  answer?: string;
}

export interface Team {
  id: TeamId;
  name: string;
  score: number;
}

export interface Cell {
  category: Category;
  points: Points;
  used: boolean;
  questionId: string;
}

export interface CurrentCell {
  category: Category;
  points: Points;
  questionId: string;
}

export interface RoomState {
  code: string;
  title: string;
  phase: Phase;
  turn: TeamId;
  teams: Record<TeamId, Team>;
  cells: Cell[];
  questions: Question[];
  current: CurrentCell | null;
  deadline: number | null;
  answerRevealed: boolean;
  createdAt: number;
  lastActivity: number;
  sfxId: number;
  sfx: Sfx | null;
}

export interface PublicRoom {
  code: string;
  title: string;
  phase: Phase;
  turn: TeamId;
  teams: Record<TeamId, Team>;
  cells: Cell[];
  questions: PublicQuestion[];
  current: CurrentCell | null;
  deadline: number | null;
  answerRevealed: boolean;
  createdAt: number;
  lastActivity: number;
  sfxId: number;
  sfx: Sfx | null;
}

export type HostIntent =
  | { type: "setTeams"; teamA: string; teamB: string }
  | { type: "setTitle"; title: string }
  | { type: "loadBank"; title?: string; questions: Question[] }
  | { type: "setQuestionImage"; questionId: string; imageUrl: string }
  | { type: "start"; startTeam: TeamId | "random" }
  | { type: "pickCell"; category: Category; points: Points }
  | { type: "judgePrimary"; correct: boolean }
  | { type: "acceptSteal" }
  | { type: "declineSteal" }
  | { type: "judgeSteal"; correct: boolean }
  | { type: "revealAnswer" }
  | { type: "skipTimer" }
  | { type: "continueReveal" }
  | { type: "adjustScore"; teamId: TeamId; delta: number }
  | { type: "endGame" };

export interface BankValidation {
  ok: boolean;
  errors: string[];
  missing: string[];
}

export interface BankSnapshot {
  questions: Question[];
  lineup: Record<string, string>;
  selected: Question[] | null;
}
