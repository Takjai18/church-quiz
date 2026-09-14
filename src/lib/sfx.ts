const KEY = "church-quiz:muted";

let ctx: AudioContext | null = null;
let lastSfxId = -1;

export function isMuted(): boolean {
  return localStorage.getItem(KEY) === "1";
}

export function setMuted(muted: boolean) {
  localStorage.setItem(KEY, muted ? "1" : "0");
}

function audio(): AudioContext | null {
  if (isMuted()) return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function beep(freq: number, duration: number, type: OscillatorType, gain = 0.08, delay = 0) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export function playSfx(kind: "pick" | "correct" | "wrong" | "finish" | "tick", sfxId?: number) {
  if (typeof sfxId === "number") {
    if (sfxId === lastSfxId) return;
    lastSfxId = sfxId;
  }
  if (kind === "pick") {
    beep(520, 0.12, "triangle", 0.07);
    beep(780, 0.1, "triangle", 0.05, 0.08);
  } else if (kind === "correct") {
    beep(523, 0.16, "sine", 0.08);
    beep(659, 0.18, "sine", 0.07, 0.08);
    beep(784, 0.28, "sine", 0.08, 0.16);
  } else if (kind === "wrong") {
    beep(180, 0.28, "sawtooth", 0.06);
    beep(120, 0.32, "square", 0.04, 0.05);
  } else if (kind === "finish") {
    beep(392, 0.18, "sine", 0.07);
    beep(523, 0.18, "sine", 0.07, 0.12);
    beep(659, 0.18, "sine", 0.07, 0.24);
    beep(784, 0.4, "sine", 0.08, 0.36);
  } else if (kind === "tick") {
    beep(880, 0.05, "square", 0.035);
  }
}

export function unlockAudio() {
  audio();
}
