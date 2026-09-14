import {
  CATEGORIES,
  POINT_VALUES,
  type Category,
  type HostIntent,
  type Points,
  type PublicQuestion,
  type PublicRoom,
  type Question,
  type RoomState,
  type Sfx,
  type TeamId,
} from "./types";
import { opponent } from "./labels";
import { validateBank } from "./validate";
import { DEMO_QUESTIONS, DEMO_TITLE } from "./demo";

export { DEMO_QUESTIONS, DEMO_TITLE };

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const IDLE_MS = 6 * 60 * 60 * 1000;
const PRIMARY_MS = 30_000;
const STEAL_OFFER_MS = 10_000;
const STEAL_MS = 30_000;

export interface StoredRoom {
  room: RoomState;
  hostToken: string;
}

function randomBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return buf;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomCode(): string {
  let out = "";
  const bytes = randomBytes(4);
  for (let i = 0; i < 4; i++) out += CODE_CHARS[bytes[i]! % CODE_CHARS.length];
  return out;
}

export function randomHostToken(): string {
  return toBase64Url(randomBytes(18));
}

function cloneQuestions(qs: Question[]): Question[] {
  return qs.map((q) => ({ ...q, accept: [...q.accept] }));
}

function cellsFromQuestions(questions: Question[]) {
  return CATEGORIES.flatMap((category) =>
    POINT_VALUES.map((points) => {
      const q = questions.find((x) => x.category === category && x.points === points);
      return {
        category,
        points,
        used: false,
        questionId: q?.id ?? `${category}-${points}`,
      };
    }),
  );
}

export function createRoomState(opts?: { teamA?: string; teamB?: string; code?: string }): RoomState {
  const questions = cloneQuestions(DEMO_QUESTIONS);
  const now = Date.now();
  return {
    code: opts?.code ?? randomCode(),
    title: DEMO_TITLE,
    phase: "lobby",
    turn: "a",
    teams: {
      a: { id: "a", name: opts?.teamA?.trim() || "紅隊", score: 0 },
      b: { id: "b", name: opts?.teamB?.trim() || "藍隊", score: 0 },
    },
    cells: cellsFromQuestions(questions),
    questions,
    current: null,
    deadline: null,
    answerRevealed: false,
    createdAt: now,
    lastActivity: now,
    sfxId: 0,
    sfx: null,
  };
}

function bumpSfx(room: RoomState, sfx: Sfx | null) {
  room.sfxId += 1;
  room.sfx = sfx;
}

function requirePhase(room: RoomState, ...phases: RoomState["phase"][]) {
  if (!phases.includes(room.phase)) {
    throw new Error("而家呢一步唔得");
  }
}

function addScore(room: RoomState, team: TeamId, delta: number) {
  room.teams[team].score += delta;
}

function enterReveal(room: RoomState, nextTurn: TeamId) {
  room.phase = "reveal";
  room.deadline = null;
  room.answerRevealed = true;
  room.turn = nextTurn;
}

export function applyIntent(room: RoomState, intent: HostIntent, now = Date.now()): RoomState {
  room.lastActivity = now;

  switch (intent.type) {
    case "setTeams": {
      const a = intent.teamA.trim();
      const b = intent.teamB.trim();
      if (a) room.teams.a.name = a;
      if (b) room.teams.b.name = b;
      return room;
    }
    case "setTitle": {
      const title = intent.title.trim();
      if (title) room.title = title;
      return room;
    }
    case "loadBank": {
      requirePhase(room, "lobby");
      const v = validateBank(intent.questions);
      if (!v.ok) throw new Error(v.errors.join("；"));
      room.questions = cloneQuestions(intent.questions);
      room.cells = cellsFromQuestions(room.questions);
      if (intent.title?.trim()) room.title = intent.title.trim();
      return room;
    }
    case "setQuestionImage": {
      requirePhase(room, "lobby");
      const q = room.questions.find((x) => x.id === intent.questionId);
      if (!q) throw new Error("搵唔到呢題");
      q.imageUrl = intent.imageUrl;
      return room;
    }
    case "start": {
      requirePhase(room, "lobby");
      const v = validateBank(room.questions);
      if (!v.ok) throw new Error(v.errors.join("；"));
      const start: TeamId =
        intent.startTeam === "random" ? (Math.random() < 0.5 ? "a" : "b") : intent.startTeam;
      room.turn = start;
      room.phase = "board";
      room.teams.a.score = 0;
      room.teams.b.score = 0;
      room.cells = room.cells.map((c) => ({ ...c, used: false }));
      room.current = null;
      room.deadline = null;
      room.answerRevealed = false;
      room.sfx = null;
      return room;
    }
    case "pickCell": {
      requirePhase(room, "board");
      const cell = room.cells.find(
        (c) => c.category === intent.category && c.points === intent.points,
      );
      if (!cell) throw new Error("冇呢格");
      if (cell.used) throw new Error("呢格用咗");
      const q = room.questions.find((x) => x.id === cell.questionId);
      if (!q) throw new Error("搵唔到題目");
      cell.used = true;
      room.current = {
        category: intent.category,
        points: intent.points,
        questionId: cell.questionId,
      };
      room.phase = "primary";
      room.deadline = now + PRIMARY_MS;
      room.answerRevealed = false;
      bumpSfx(room, "pick");
      return room;
    }
    case "judgePrimary": {
      requirePhase(room, "primary");
      if (!room.current) throw new Error("未揀題");
      const pts = room.current.points;
      const t = room.turn;
      if (intent.correct) {
        addScore(room, t, pts);
        bumpSfx(room, "correct");
        enterReveal(room, opponent(t));
      } else {
        addScore(room, t, -pts);
        bumpSfx(room, "wrong");
        room.phase = "steal_offer";
        room.deadline = now + STEAL_OFFER_MS;
      }
      return room;
    }
    case "acceptSteal": {
      requirePhase(room, "steal_offer");
      room.phase = "steal";
      room.deadline = now + STEAL_MS;
      return room;
    }
    case "declineSteal": {
      requirePhase(room, "steal_offer");
      enterReveal(room, opponent(room.turn));
      return room;
    }
    case "judgeSteal": {
      requirePhase(room, "steal");
      if (!room.current) throw new Error("未揀題");
      const pts = room.current.points;
      const o = opponent(room.turn);
      if (intent.correct) {
        addScore(room, o, pts);
        bumpSfx(room, "correct");
      } else {
        addScore(room, o, -pts);
        bumpSfx(room, "wrong");
      }
      enterReveal(room, o);
      return room;
    }
    case "revealAnswer": {
      if (room.phase === "lobby" || room.phase === "board" || room.phase === "finished") {
        throw new Error("而家唔使揭示");
      }
      room.answerRevealed = true;
      return room;
    }
    case "skipTimer": {
      if (room.phase !== "primary" && room.phase !== "steal_offer" && room.phase !== "steal") {
        throw new Error("而家冇計時");
      }
      room.deadline = null;
      return room;
    }
    case "continueReveal": {
      requirePhase(room, "reveal");
      const used = room.cells.filter((c) => c.used).length;
      room.current = null;
      room.answerRevealed = false;
      room.deadline = null;
      if (used >= 12) {
        room.phase = "finished";
        bumpSfx(room, "finish");
      } else {
        room.phase = "board";
      }
      return room;
    }
    case "adjustScore": {
      if (intent.delta !== 10 && intent.delta !== -10) {
        throw new Error("只可以 ±10");
      }
      addScore(room, intent.teamId, intent.delta);
      return room;
    }
    case "endGame": {
      if (room.phase === "lobby") throw new Error("未開場");
      room.phase = "finished";
      room.deadline = null;
      room.current = null;
      bumpSfx(room, "finish");
      return room;
    }
  }
}

export function tickRoom(room: RoomState, now = Date.now()): boolean {
  if (!room.deadline || now < room.deadline) return false;
  if (room.phase === "primary") {
    applyIntent(room, { type: "judgePrimary", correct: false }, now);
    return true;
  }
  if (room.phase === "steal_offer") {
    applyIntent(room, { type: "declineSteal" }, now);
    return true;
  }
  if (room.phase === "steal") {
    applyIntent(room, { type: "judgeSteal", correct: false }, now);
    return true;
  }
  return false;
}

export function publicQuestion(q: Question, revealed: boolean): PublicQuestion {
  return {
    id: q.id,
    category: q.category,
    points: q.points,
    prompt: q.prompt,
    imageUrl: q.imageUrl,
    askFor: q.askFor,
    ...(revealed ? { answer: q.answer } : {}),
  };
}

export function toPublicRoom(room: RoomState): PublicRoom {
  const showAnswer =
    room.answerRevealed &&
    (room.phase === "reveal" ||
      room.phase === "primary" ||
      room.phase === "steal_offer" ||
      room.phase === "steal");
  return {
    code: room.code,
    title: room.title,
    phase: room.phase,
    turn: room.turn,
    teams: {
      a: { ...room.teams.a },
      b: { ...room.teams.b },
    },
    cells: room.cells.map((c) => ({ ...c })),
    questions: room.questions.map((q) =>
      publicQuestion(q, showAnswer && room.current?.questionId === q.id),
    ),
    current: room.current ? { ...room.current } : null,
    deadline: room.deadline,
    answerRevealed: room.answerRevealed,
    createdAt: room.createdAt,
    lastActivity: room.lastActivity,
    sfxId: room.sfxId,
    sfx: room.sfx,
  };
}

export function isIdle(room: RoomState, now = Date.now()): boolean {
  return now - room.lastActivity > IDLE_MS;
}

export function pickCellKey(category: Category, points: Points) {
  return `${category}-${points}`;
}
