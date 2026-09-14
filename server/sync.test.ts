import assert from "node:assert/strict";
import { io as client, type Socket } from "socket.io-client";
import type { PublicRoom, RoomState } from "../shared/types";

const URL = process.env.QUIZ_URL || "http://127.0.0.1:3000";

function nextState<T>(socket: Socket, timeout = 4000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout waiting for state")), timeout);
    const onErr = (msg: string) => {
      clearTimeout(t);
      socket.off("state", onState);
      reject(new Error(msg));
    };
    const onState = (payload: T) => {
      clearTimeout(t);
      socket.off("errorMsg", onErr);
      resolve(payload);
    };
    socket.once("state", onState);
    socket.once("errorMsg", onErr);
  });
}

function nextError(socket: Socket, timeout = 4000): Promise<string> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout waiting for error")), timeout);
    socket.once("errorMsg", (msg: string) => {
      clearTimeout(t);
      resolve(msg);
    });
  });
}

async function main() {
  const host = client(URL, { transports: ["websocket"] });
  const created = await new Promise<{ roomCode: string; hostToken: string; room: RoomState }>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("create timeout")), 4000);
    host.once("created", (payload) => {
      clearTimeout(t);
      resolve(payload);
    });
    host.once("errorMsg", (msg) => {
      clearTimeout(t);
      reject(new Error(msg));
    });
    host.emit("create", { teamA: "甲隊", teamB: "乙隊" });
  });
  const code = created.roomCode;
  assert.equal(created.room.code.length, 4);

  const play = client(URL, { transports: ["websocket"] });
  const playWait = nextState<PublicRoom>(play);
  play.emit("join", { roomCode: code, role: "play" });
  const joined = await playWait;
  assert.equal(joined.phase, "lobby");
  assert.ok(joined.questions.every((q) => q.answer === undefined), "join must not leak answers");

  const display = client(URL, { transports: ["websocket"] });
  const displayWait = nextState<PublicRoom>(display);
  display.emit("join", { roomCode: code, role: "display" });
  await displayWait;

  let playState = nextState<PublicRoom>(play);
  host.emit("host", { type: "start", startTeam: "a" });
  let pub = await playState;
  assert.equal(pub.phase, "board");
  assert.equal(pub.turn, "a");

  playState = nextState<PublicRoom>(play);
  host.emit("host", { type: "pickCell", category: "bible", points: 10 });
  pub = await playState;
  assert.equal(pub.phase, "primary");
  const pubQ = pub.questions.find((q) => q.id === pub.current?.questionId);
  assert.equal(pubQ?.answer, undefined, "Display never leaks the answer before reveal");
  assert.equal(pubQ?.imageUrl, undefined);
  assert.match(pubQ?.prompt ?? "", /海面/);

  playState = nextState<PublicRoom>(play);
  host.emit("host", { type: "judgePrimary", correct: true });
  pub = await playState;
  assert.equal(pub.teams.a.score, 10);
  assert.equal(pub.turn, "b");
  assert.equal(pub.phase, "reveal");
  assert.equal(pub.questions.find((q) => q.id === pub.current?.questionId)?.answer, "加利利海");

  playState = nextState<PublicRoom>(play);
  host.emit("host", { type: "continueReveal" });
  pub = await playState;
  assert.equal(pub.phase, "board");
  assert.equal(pub.turn, "b", "A correct -> B picks next");

  playState = nextState<PublicRoom>(play);
  host.emit("host", { type: "pickCell", category: "kdrama", points: 10 });
  pub = await playState;
  const kd = pub.questions.find((q) => q.id === pub.current?.questionId);
  assert.ok(kd?.imageUrl, "K-drama cell shows image on Display");
  assert.equal(kd?.answer, undefined);

  playState = nextState<PublicRoom>(play);
  host.emit("host", { type: "judgePrimary", correct: false });
  pub = await playState;
  assert.equal(pub.teams.b.score, -10);
  assert.equal(pub.phase, "steal_offer");

  playState = nextState<PublicRoom>(play);
  host.emit("host", { type: "acceptSteal" });
  pub = await playState;
  playState = nextState<PublicRoom>(play);
  host.emit("host", { type: "judgeSteal", correct: true });
  pub = await playState;
  assert.equal(pub.teams.a.score, 20);
  assert.equal(pub.turn, "a", "B wrong, A steal correct -> A picks next");

  const host2 = client(URL, { transports: ["websocket"] });
  const resumeWait = nextState<RoomState>(host2);
  host2.emit("resume", { roomCode: code, hostToken: created.hostToken });
  const resumed = await resumeWait;
  assert.equal(resumed.teams.a.score, 20);
  assert.equal(resumed.teams.b.score, -10);
  assert.equal(resumed.turn, "a", "Host refresh does not reset score or turn");
  assert.equal(resumed.questions.find((q) => q.id === "kdrama-10")?.answer, "愛的迫降");

  const rest = await fetch(`${URL}/api/room/${code}`).then((r) => r.json());
  assert.equal(rest.teams.a.score, 20);

  const lobbyHost = client(URL, { transports: ["websocket"] });
  const lobbyCreated = await new Promise<{ room: RoomState }>((resolve, reject) => {
    lobbyHost.once("created", resolve);
    lobbyHost.once("errorMsg", (m) => reject(new Error(m)));
    lobbyHost.emit("create", { teamA: "A", teamB: "B" });
  });
  void lobbyCreated;
  const errWait = nextError(lobbyHost);
  lobbyHost.emit("host", {
    type: "loadBank",
    questions: [{ id: "x", category: "bible", points: 10, prompt: "q", answer: "a", accept: [] }],
  });
  const err = await errWait;
  assert.ok(err.includes("12") || err.includes("缺少"), err);

  const html = await fetch(`${URL}/host`).then((r) => r.text());
  assert.match(html, /教會冰破問答|root/);
  const kdrama = await fetch(`${URL}/kdrama/cloy.jpg`);
  assert.equal(kdrama.ok, true);

  host.close();
  host2.close();
  play.close();
  display.close();
  lobbyHost.close();
  console.log("sync.test.ts ok", code);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
