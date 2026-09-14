import assert from "node:assert/strict";
import { applyIntent, createRoomState, publicQuestion, tickRoom, toPublicRoom } from "./rooms";
import { parseBankJson, validateBank } from "../shared/validate";
import { DEMO_QUESTIONS } from "./questions";
import { opponent, statusLine, winnerId } from "../shared/labels";
import type { Category, Points, Question } from "../shared/types";

function start(turn: "a" | "b" = "a") {
  const room = createRoomState({ teamA: "甲隊", teamB: "乙隊" });
  applyIntent(room, { type: "start", startTeam: turn });
  return room;
}

function pick(room: ReturnType<typeof start>, category: Category, points: Points, now = 1_000_000) {
  applyIntent(room, { type: "pickCell", category, points }, now);
}

function remaining(questions: Question[], drop: Array<[Category, Points]>) {
  return questions.filter((q) => !drop.some(([c, p]) => q.category === c && q.points === p));
}

{
  const v = validateBank(DEMO_QUESTIONS);
  assert.equal(v.ok, true, "demo bank must be valid");
}

{
  const room = start("a");
  pick(room, "bible", 10);
  applyIntent(room, { type: "judgePrimary", correct: true });
  assert.equal(room.teams.a.score, 10);
  assert.equal(room.teams.b.score, 0);
  assert.equal(room.turn, "b");
  assert.equal(room.phase, "reveal");
  applyIntent(room, { type: "continueReveal" });
  assert.equal(room.phase, "board");
  assert.equal(room.turn, "b", "A correct -> B picks next");
  assert.equal(statusLine(room), "輪到【乙隊】揀題");
}

{
  const room = start("a");
  pick(room, "bible", 30);
  applyIntent(room, { type: "judgePrimary", correct: false });
  assert.equal(room.teams.a.score, -30);
  assert.equal(room.phase, "steal_offer");
  assert.equal(statusLine(room), "【乙隊】要唔要補答？");
  applyIntent(room, { type: "acceptSteal" });
  applyIntent(room, { type: "judgeSteal", correct: true });
  assert.equal(room.teams.b.score, 30);
  assert.equal(room.teams.a.score, -30);
  assert.equal(room.turn, "b");
  applyIntent(room, { type: "continueReveal" });
  assert.equal(room.turn, "b", "A wrong, B steal correct -> B picks next");
}

{
  const room = start("a");
  pick(room, "pop", 50);
  applyIntent(room, { type: "judgePrimary", correct: false });
  applyIntent(room, { type: "acceptSteal" });
  applyIntent(room, { type: "judgeSteal", correct: false });
  assert.equal(room.teams.a.score, -50);
  assert.equal(room.teams.b.score, -50);
  assert.equal(room.turn, "b", "both lose, B picks next");
}

{
  const room = start("a");
  pick(room, "pun", 10);
  applyIntent(room, { type: "judgePrimary", correct: false });
  applyIntent(room, { type: "declineSteal" });
  assert.equal(room.teams.a.score, -10);
  assert.equal(room.teams.b.score, 0);
  assert.equal(room.turn, "b", "A wrong, B declines -> only A loses, B picks");
}

{
  const room = start("a");
  const now = 5_000_000;
  pick(room, "bible", 50, now);
  const changed = tickRoom(room, now + 30_000);
  assert.equal(changed, true);
  assert.equal(room.teams.a.score, -50);
  assert.equal(room.phase, "steal_offer", "30s primary timeout counts as wrong");
}

{
  const room = start("a");
  const now = 8_000_000;
  pick(room, "kdrama", 10, now);
  applyIntent(room, { type: "judgePrimary", correct: false }, now);
  const changed = tickRoom(room, now + 10_000);
  assert.equal(changed, true);
  assert.equal(room.phase, "reveal");
  assert.equal(room.teams.b.score, 0, "steal-offer timeout is decline, O not penalized");
  assert.equal(room.turn, "b");
}

{
  const room = start("a");
  applyIntent(room, { type: "adjustScore", teamId: "a", delta: -10 });
  applyIntent(room, { type: "adjustScore", teamId: "a", delta: -10 });
  assert.equal(room.teams.a.score, -20, "negative scores work");
}

{
  const room = start("a");
  let n = 0;
  for (const c of ["bible", "pop", "kdrama", "pun"] as Category[]) {
    for (const p of [10, 30, 50] as Points[]) {
      pick(room, c, p, 1_000 + n);
      applyIntent(room, { type: "judgePrimary", correct: true }, 2_000 + n);
      applyIntent(room, { type: "continueReveal" }, 3_000 + n);
      n += 1;
    }
  }
  assert.equal(room.phase, "finished", "game ends only after cell 12 is fully resolved");
  assert.equal(room.teams.a.score + room.teams.b.score, 360);
}

{
  const room = start("a");
  const cats: Category[] = ["bible", "pop", "kdrama", "pun"];
  const pts: Points[] = [10, 30, 50];
  let i = 0;
  for (const c of cats) {
    for (const p of pts) {
      pick(room, c, p, 10_000 + i);
      const t = room.turn;
      applyIntent(room, { type: "judgePrimary", correct: true }, 11_000 + i);
      assert.equal(room.turn, opponent(t));
      applyIntent(room, { type: "continueReveal" }, 12_000 + i);
      i += 1;
    }
  }
  assert.equal(room.teams.a.score, 180);
  assert.equal(room.teams.b.score, 180);
  assert.equal(winnerId(room), "tie");
  assert.equal(statusLine(room), "打和！");
}

{
  const room = start("a");
  pick(room, "kdrama", 50);
  const pub = toPublicRoom(room);
  const q = pub.questions.find((x) => x.id === "kdrama-50")!;
  assert.equal(q.answer, undefined, "Display never leaks the answer before reveal");
  assert.ok(q.imageUrl, "K-drama cell shows image on Display");
  assert.equal(q.imageUrl, "/kdrama/glory.jpg");
  const hostQ = room.questions.find((x) => x.id === "kdrama-50")!;
  assert.equal(hostQ.answer, "黑暗榮耀");
  applyIntent(room, { type: "revealAnswer" });
  const pub2 = toPublicRoom(room);
  assert.equal(pub2.questions.find((x) => x.id === "kdrama-50")?.answer, "黑暗榮耀");
}

{
  const incomplete = remaining(DEMO_QUESTIONS, [["pun", 50]]);
  const v = validateBank(incomplete);
  assert.equal(v.ok, false);
  assert.ok(v.missing.some((m) => m.includes("冷笑話") && m.includes("50")));
  const room = createRoomState();
  assert.throws(() => applyIntent(room, { type: "loadBank", questions: incomplete }));
  assert.throws(() => {
    room.questions = incomplete;
    applyIntent(room, { type: "start", startTeam: "a" });
  });
}

{
  const last = start("a");
  const cats: Category[] = ["bible", "pop", "kdrama", "pun"];
  const pts: Points[] = [10, 30, 50];
  let i = 0;
  for (const c of cats) {
    for (const p of pts) {
      if (c === "pun" && p === 50) continue;
      pick(last, c, p, 20_000 + i);
      applyIntent(last, { type: "judgePrimary", correct: true }, 21_000 + i);
      applyIntent(last, { type: "continueReveal" }, 22_000 + i);
      i += 1;
    }
  }
  assert.equal(last.phase, "board");
  pick(last, "pun", 50);
  applyIntent(last, { type: "judgePrimary", correct: false });
  assert.equal(last.phase, "steal_offer", "optional steal still offered on last cell");
  applyIntent(last, { type: "acceptSteal" });
  applyIntent(last, { type: "judgeSteal", correct: true });
  applyIntent(last, { type: "continueReveal" });
  assert.equal(last.phase, "finished");
}

{
  const json = JSON.stringify({ title: "測試", questions: DEMO_QUESTIONS });
  const parsed = parseBankJson(json);
  assert.equal(parsed.title, "測試");
  assert.equal(validateBank(parsed.questions).ok, true);
}

{
  const q = DEMO_QUESTIONS.find((x) => x.id === "bible-10")!;
  assert.equal(publicQuestion(q, false).answer, undefined);
  assert.equal(publicQuestion(q, true).answer, "加利利海");
}

console.log("rooms.test.ts ok");
