type Handler = (payload: any) => void;

class QuizSocket {
  connected = false;
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<Handler>>();
  private roomCode = "";
  private hostToken = "";
  private role: "host" | "play" | "display" = "play";
  private reconnectTimer: number | null = null;
  private stopRetry = false;

  on(event: string, fn: Handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
  }

  off(event: string, fn: Handler) {
    this.listeners.get(event)?.delete(fn);
  }

  private fire(event: string, payload?: unknown) {
    this.listeners.get(event)?.forEach((fn) => fn(payload));
  }

  connect() {
    this.fire("connect");
  }

  emit(event: string, payload?: any) {
    if (event === "create") void this.create(payload);
    else if (event === "resume") void this.resume(payload);
    else if (event === "join") void this.join(payload);
    else if (event === "host") this.send({ type: "host", intent: payload });
  }

  private send(msg: object) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private async create(payload?: { teamA?: string; teamB?: string }) {
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      this.fire("errorMsg", data.error || "開房失敗");
      return;
    }
    this.roomCode = data.roomCode;
    this.hostToken = data.hostToken;
    this.role = "host";
    this.fire("created", data);
    this.openWs();
  }

  private async resume(payload: { roomCode?: string; hostToken?: string }) {
    this.roomCode = String(payload?.roomCode || "").toUpperCase();
    this.hostToken = String(payload?.hostToken || "");
    this.role = "host";
    const probe = await fetch(`/api/room/${this.roomCode}`);
    if (!probe.ok) {
      this.fire("errorMsg", "搵唔到呢房");
      return;
    }
    this.openWs();
  }

  private join(payload: { roomCode?: string; role?: "play" | "display" }) {
    this.roomCode = String(payload?.roomCode || "").toUpperCase();
    this.role = payload?.role === "display" ? "display" : "play";
    this.hostToken = "";
    this.openWs();
  }

  private openWs() {
    this.stopRetry = false;
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const params = new URLSearchParams({ role: this.role });
    if (this.hostToken) params.set("token", this.hostToken);
    const ws = new WebSocket(`${proto}://${location.host}/ws/${this.roomCode}?${params}`);
    this.ws = ws;
    ws.onopen = () => {
      this.connected = true;
    };
    ws.onmessage = (ev) => {
      if (ev.data === "pong") return;
      let msg: { type?: string; room?: unknown; message?: string };
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (msg.type === "state") this.fire("state", msg.room);
      if (msg.type === "error") {
        this.fire("errorMsg", msg.message);
        if (msg.message === "主持權限唔啱" || msg.message === "搵唔到呢房") {
          this.stopRetry = true;
          this.roomCode = "";
        }
      }
    };
    ws.onclose = () => {
      this.connected = false;
      if (this.stopRetry || !this.roomCode) return;
      this.reconnectTimer = window.setTimeout(() => this.openWs(), 800);
    };
    ws.onerror = () => {
      // onclose handles retry
    };
  }
}

let socket: QuizSocket | null = null;

export function getSocket(): QuizSocket {
  if (!socket) socket = new QuizSocket();
  return socket;
}
