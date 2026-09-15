import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import Board from "../components/Board";
import GameSetup, { buildGamePayload, defaultCatSetup, type CatSetup } from "../components/GameSetup";
import JudgeBar from "../components/JudgeBar";
import MuteButton from "../components/MuteButton";
import PromptCard from "../components/PromptCard";
import Scoreboard from "../components/Scoreboard";
import Stage from "../components/Stage";
import Timer from "../components/Timer";
import { getSocket } from "../lib/socket";
import { playSfx, unlockAudio } from "../lib/sfx";
import {
  clearHostSession,
  loadHostSession,
  loadHostView,
  loadLocalBank,
  saveHostSession,
  saveHostView,
  type HostView,
} from "../lib/storage";
import { currentQuestion, statusLine } from "../../shared/labels";
import { validateBank } from "../../shared/validate";
import type { BankSnapshot, HostIntent, Question, RoomState, TeamId } from "../../shared/types";

type Info = { lan: string[]; origin: string };

export default function Host() {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState("");
  const [teamA, setTeamA] = useState("紅隊");
  const [teamB, setTeamB] = useState("藍隊");
  const [startTeam, setStartTeam] = useState<TeamId | "random">("random");
  const [info, setInfo] = useState<Info | null>(null);
  const [copied, setCopied] = useState(false);
  const [bankError, setBankError] = useState("");
  const [view, setView] = useState<HostView>(() => loadHostView());
  const [draftQs, setDraftQs] = useState<Question[] | null>(null);
  const [bankSnap, setBankSnap] = useState<BankSnapshot | null>(null);
  const [setup, setSetup] = useState<CatSetup[]>([]);
  const lastSfx = useRef(-1);
  const appliedLocal = useRef(false);

  function switchView(next: HostView) {
    setView(next);
    saveHostView(next);
  }

  useEffect(() => {
    void fetch("/api/info")
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => undefined);
    void fetch("/api/bank")
      .then((r) => r.json())
      .then((snap: BankSnapshot) => {
        setBankSnap(snap);
        setSetup((prev) => (prev.length ? prev : defaultCatSetup(snap.categories || [])));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const s = getSocket();
    const onCreated = (payload: { roomCode: string; hostToken: string; room: RoomState }) => {
      saveHostSession(payload.roomCode, payload.hostToken);
      setRoom(payload.room);
      setTeamA(payload.room.teams.a.name);
      setTeamB(payload.room.teams.b.name);
      setError("");
      if (payload.room.phase === "lobby") {
        setView("admin");
        saveHostView("admin");
      }
      void (async () => {
        if (appliedLocal.current) return;
        try {
          const snap = await fetch("/api/bank").then((r) => r.json());
          if (snap.selected?.length === 12) {
            appliedLocal.current = true;
            getSocket().emit("host", {
              type: "loadBank",
              title: "青年小組冰破",
              questions: snap.selected,
              categories: snap.categories,
            });
            setDraftQs(snap.selected.map((q: Question) => ({ ...q, accept: [...q.accept] })));
            return;
          }
        } catch {
          // fall through
        }
        const saved = loadLocalBank();
        if (saved) {
          appliedLocal.current = true;
          getSocket().emit("host", { type: "loadBank", title: saved.title, questions: saved.questions });
          setDraftQs(saved.questions.map((q) => ({ ...q, accept: [...q.accept] })));
        } else {
          setDraftQs(payload.room.questions.map((q) => ({ ...q, accept: [...q.accept] })));
        }
      })();
    };
    const onState = (next: RoomState) => {
      setRoom(next);
      setTeamA(next.teams.a.name);
      setTeamB(next.teams.b.name);
      if (next.phase === "lobby") {
        setDraftQs((prev) => prev ?? next.questions.map((q) => ({ ...q, accept: [...q.accept] })));
      }
      if (next.sfx && next.sfxId !== lastSfx.current) {
        lastSfx.current = next.sfxId;
        playSfx(next.sfx, next.sfxId);
      }
    };
    const onErr = (msg: string) => {
      setError(msg);
      if (msg === "搵唔到呢房" || msg === "主持權限唔啱") {
        clearHostSession();
        s.emit("create", { teamA, teamB });
      }
    };
    s.on("created", onCreated);
    s.on("state", onState);
    s.on("errorMsg", onErr);

    const connect = () => {
      const saved = loadHostSession();
      if (saved) s.emit("resume", saved);
      else s.emit("create", { teamA, teamB });
    };
    s.on("connect", connect);
    if (s.connected) connect();
    else s.connect();

    return () => {
      s.off("created", onCreated);
      s.off("state", onState);
      s.off("errorMsg", onErr);
      s.off("connect", connect);
    };
    // create/resume once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function send(intent: HostIntent) {
    unlockAudio();
    setError("");
    getSocket().emit("host", intent);
  }

  function startGame() {
    send({ type: "setTeams", teamA, teamB });
    if (setup.some((c) => c.on) && bankSnap) {
      const payload = buildGamePayload(setup, bankSnap);
      const need = setup.filter((c) => c.on).reduce((n, c) => n + c.count, 0);
      if (payload.slots.length < need) {
        setError("備用題唔夠，請去題庫入多啲或減少題數");
        switchView("admin");
        return;
      }
      send({ type: "configureGame", ...payload });
    }
    send({ type: "start", startTeam });
    switchView("game");
  }

  function newRoom() {
    clearHostSession();
    setRoom(null);
    setDraftQs(null);
    appliedLocal.current = false;
    getSocket().emit("create", { teamA, teamB });
  }



  const bank = useMemo(
    () => (draftQs ? validateBank(draftQs) : room ? validateBank(room.questions) : null),
    [draftQs, room],
  );

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const qrOrigin =
    info?.lan?.[0] && /localhost|127\.0\.0\.1/.test(origin) ? info.lan[0] : origin;
  const playUrl = room ? `${qrOrigin}/play/${room.code}` : "";
  const displayUrl = room ? `${origin}/d/${room.code}` : "";
  const lanHint = info?.lan ?? [];

  if (!room) {
    return (
      <div className="page center">
        <p>開房中…</p>
        {error ? <p className="error">{error}</p> : null}
      </div>
    );
  }

  const q = currentQuestion(room) as Question | undefined;
  const timerTotal = room.phase === "steal_offer" ? 10 : 30;

  return (
    <div className={`page host-page ${view === "game" ? "display-page" : ""}`} onPointerDown={unlockAudio}>
      <header className="host-bar">
        <div>
          <p className="eyebrow">{view === "game" ? "遊戲模式" : "後台模式"} · {room.title}</p>
          {view === "admin" ? <h1>房號 {room.code}</h1> : null}
        </div>
        <div className="host-bar-actions">
          <div className="mode-switch" role="tablist" aria-label="主持模式">
            <button
              type="button"
              className={`btn ${view === "admin" ? "primary" : "ghost"}`}
              onClick={() => switchView("admin")}
            >
              後台
            </button>
            <button
              type="button"
              className={`btn ${view === "game" ? "primary" : "ghost"}`}
              onClick={() => switchView("game")}
            >
              遊戲
            </button>
          </div>
          <MuteButton />
          {view === "admin" ? (
            <>
              <Link className="btn ghost" to="/bank">
                題庫
              </Link>
              <button className="btn ghost" type="button" onClick={() => window.open(displayUrl, "_blank")}>
                開大螢幕
              </button>
              <button className="btn ghost" type="button" onClick={newRoom}>
                新開一房
              </button>
            </>
          ) : null}
        </div>
      </header>

      {error && view === "admin" ? <p className="error banner">{error}</p> : null}

      {view === "game" ? (
        <Stage
          room={room}
          interactive={room.phase === "board"}
          onPick={(cell) => send({ type: "pickCell", category: cell.category, points: cell.points, cellId: cell.id, slot: cell.slot })}
          showAnswer={room.answerRevealed}
          footer={
            room.phase === "lobby" ? (
              <button className="btn primary wide huge-btn" type="button" onClick={startGame}>
                開場
              </button>
            ) : (
              <JudgeBar room={room} onIntent={send} />
            )
          }
        />
      ) : room.phase === "lobby" ? (
        <div className="lobby-grid">
          <section className="panel">
            <h2>房間</h2>
            <div className="code-row">
              <span className="big-code">{room.code}</span>
              <button
                className="btn"
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(room.code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1200);
                }}
              >
                {copied ? "已複製" : "複製房號"}
              </button>
            </div>
            <div className="qr-wrap">
              <QRCodeSVG value={playUrl} size={168} bgColor="#f4efe4" fgColor="#0a0c10" />
              <p>手機掃碼旁觀</p>
            </div>
            <p className="hint">大螢幕網址：{displayUrl}</p>
            {lanHint.length ? (
              <p className="hint">同一 Wi-Fi 手機可用：{lanHint.map((u) => `${u}/play/${room.code}`).join(" 或 ")}</p>
            ) : null}
            <label>
              紅隊名稱
              <input value={teamA} onChange={(e) => setTeamA(e.target.value)} />
            </label>
            <label>
              藍隊名稱
              <input value={teamB} onChange={(e) => setTeamB(e.target.value)} />
            </label>
            <button className="btn" type="button" onClick={() => send({ type: "setTeams", teamA, teamB })}>
              更新隊名
            </button>
            <h3>邊隊先揀</h3>
            <div className="choice-row">
              {(["a", "b", "random"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`btn ${startTeam === v ? "primary" : ""}`}
                  onClick={() => setStartTeam(v)}
                >
                  {v === "a" ? teamA : v === "b" ? teamB : "隨機"}
                </button>
              ))}
            </div>
            <p className="hint">
              改題同答案只喺 <Link to="/bank">題庫專頁</Link>，呢度唔會顯示。
            </p>
            <button className="btn primary wide huge-btn" type="button" onClick={startGame}>
              開場
            </button>
          </section>
          {setup.length ? <GameSetup setup={setup} onChange={setSetup} bank={bankSnap} /> : null}
        </div>
      ) : (
        <div className="play-grid">
          <section className="panel board-panel">
            <Scoreboard room={room} />
            <p className="status-line host-status">{statusLine(room)}</p>
            <Timer deadline={room.deadline} totalSec={timerTotal} />
            <Board
              room={room}
              interactive
              onPick={(cell) => send({ type: "pickCell", category: cell.category, points: cell.points, cellId: cell.id, slot: cell.slot })}
            />
          </section>
          <section className="panel controls">
            <PromptCard room={room} />
            {q && room.phase !== "board" && room.phase !== "finished" ? (
              <div className="host-answer">
                <h2>答案（只主持見到）</h2>
                <p className="answer-main">{q.answer}</p>
                {q.accept?.length ? (
                  <p className="accept">可接受：{q.accept.join("、")}</p>
                ) : null}
                {q.hostNote ? <p className="host-note">{q.hostNote}</p> : null}
              </div>
            ) : null}

            <JudgeBar room={room} onIntent={send} compact />
            <div className="btn-grid">
              {room.phase !== "finished" && room.phase !== "board" && room.phase !== "reveal" ? (
                <>
                  <button className="btn" type="button" onClick={() => send({ type: "revealAnswer" })}>
                    揭示答案
                  </button>
                  {room.deadline ? (
                    <button className="btn" type="button" onClick={() => send({ type: "skipTimer" })}>
                      跳過計時
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="adjust">
              <h3>分數微調</h3>
              {(["a", "b"] as const).map((id) => (
                <div key={id} className="adjust-row">
                  <span>{room.teams[id].name}</span>
                  <button className="btn" type="button" onClick={() => send({ type: "adjustScore", teamId: id, delta: 10 })}>
                    +10
                  </button>
                  <button className="btn" type="button" onClick={() => send({ type: "adjustScore", teamId: id, delta: -10 })}>
                    −10
                  </button>
                </div>
              ))}
            </div>

            {room.phase !== "finished" ? (
              <button
                className="btn bad wide"
                type="button"
                onClick={() => {
                  if (window.confirm("確定完場？")) send({ type: "endGame" });
                }}
              >
                完場
              </button>
            ) : (
              <p className="finish-banner">{statusLine(room)}</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
