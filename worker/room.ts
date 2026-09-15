import { DurableObject } from "cloudflare:workers";
import {
  applyIntent,
  createRoomState,
  IDLE_MS,
  isIdle,
  randomHostToken,
  tickRoom,
  toPublicRoom,
} from "../shared/game";
import type { HostIntent, RoomState } from "../shared/types";

export class QuizRoom extends DurableObject<Env> {
  private room: RoomState | null = null;
  private hostToken: string | null = null;
  private loaded = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS images (
          id TEXT PRIMARY KEY,
          mime TEXT NOT NULL,
          data BLOB NOT NULL
        )
      `);
      this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    });
  }

  private async ensureLoaded() {
    if (this.loaded) return;
    this.room = (await this.ctx.storage.get<RoomState>("room")) ?? null;
    this.hostToken = (await this.ctx.storage.get<string>("hostToken")) ?? null;
    this.loaded = true;
  }

  private async persist() {
    if (!this.room || !this.hostToken) return;
    await this.ctx.storage.put("room", this.room);
    await this.ctx.storage.put("hostToken", this.hostToken);
  }

  private async schedule() {
    if (!this.room) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    const next = this.room.deadline ?? this.room.lastActivity + IDLE_MS;
    await this.ctx.storage.setAlarm(next);
  }

  async tryCreate(teamA: string, teamB: string, code: string) {
    await this.ensureLoaded();
    if (this.room && !isIdle(this.room)) return { ok: false as const };
    this.room = createRoomState({ teamA, teamB, code });
    this.hostToken = randomHostToken();
    await this.persist();
    await this.schedule();
    return { ok: true as const, hostToken: this.hostToken, room: this.room };
  }

  async applyHost(token: string, intent: HostIntent) {
    await this.ensureLoaded();
    if (!this.room || token !== this.hostToken) throw new Error("主持權限唔啱");
    applyIntent(this.room, intent);
    await this.persist();
    await this.schedule();
    this.broadcast();
    return this.room;
  }

  async publicSnapshot() {
    await this.ensureLoaded();
    if (!this.room || isIdle(this.room)) return null;
    return toPublicRoom(this.room);
  }

  async putImage(hostToken: string, mime: string, data: ArrayBuffer) {
    await this.ensureLoaded();
    if (!this.room || hostToken !== this.hostToken) throw new Error("主持權限唔啱");
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    this.ctx.storage.sql.exec("INSERT INTO images (id, mime, data) VALUES (?, ?, ?)", id, mime, data);
    return { url: `/uploads/${this.room.code}/${id}` };
  }

  async getImage(id: string): Promise<{ mime: string; data: ArrayBuffer } | null> {
    const row = this.ctx.storage.sql
      .exec<{ mime: string; data: ArrayBuffer }>("SELECT mime, data FROM images WHERE id = ?", id)
      .toArray()[0];
    return row ?? null;
  }

  async fetch(request: Request): Promise<Response> {
    await this.ensureLoaded();
    const url = new URL(request.url);

    if (request.headers.get("Upgrade") === "websocket") {
      if (!this.room || isIdle(this.room)) {
        return new Response("搵唔到呢房", { status: 404 });
      }
      const role = url.searchParams.get("role") === "host" ? "host" : url.searchParams.get("role") === "display" ? "display" : "play";
      const token = url.searchParams.get("token") || "";
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      if (role === "host" && token !== this.hostToken) {
        this.ctx.acceptWebSocket(server);
        server.send(JSON.stringify({ type: "error", message: "主持權限唔啱" }));
        server.close(1008, "auth");
        return new Response(null, { status: 101, webSocket: client });
      }
      this.ctx.acceptWebSocket(server, [role]);
      server.serializeAttachment({ role, token });
      server.send(JSON.stringify({ type: "state", room: role === "host" ? this.room : toPublicRoom(this.room) }));
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("ok");
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    await this.ensureLoaded();
    if (typeof message !== "string" || message === "ping") return;
    let parsed: { type?: string; intent?: HostIntent };
    try {
      parsed = JSON.parse(message) as { type?: string; intent?: HostIntent };
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "訊息無效" }));
      return;
    }
    const meta = (ws.deserializeAttachment() || {}) as { role?: string; token?: string };
    if (parsed.type !== "host") return;
    if (meta.role !== "host" || meta.token !== this.hostToken) {
      ws.send(JSON.stringify({ type: "error", message: "唔係主持" }));
      return;
    }
    if (!this.room) {
      ws.send(JSON.stringify({ type: "error", message: "搵唔到呢房" }));
      return;
    }
    try {
      applyIntent(this.room, parsed.intent as HostIntent);
      await this.persist();
      await this.schedule();
      this.broadcast();
    } catch (err) {
      ws.send(JSON.stringify({ type: "error", message: err instanceof Error ? err.message : "出錯" }));
    }
  }

  async webSocketClose(ws: WebSocket) {
    ws.close();
  }

  async alarm() {
    await this.ensureLoaded();
    if (!this.room) return;
    if (isIdle(this.room)) {
      await this.ctx.storage.deleteAll();
      this.room = null;
      this.hostToken = null;
      this.loaded = true;
      for (const ws of this.ctx.getWebSockets()) {
        ws.close(1000, "expired");
      }
      return;
    }
    if (tickRoom(this.room)) {
      await this.persist();
      this.broadcast();
    }
    await this.schedule();
  }

  private broadcast() {
    if (!this.room) return;
    const full = JSON.stringify({ type: "state", room: this.room });
    const pub = JSON.stringify({ type: "state", room: toPublicRoom(this.room) });
    for (const socket of this.ctx.getWebSockets()) {
      const meta = (socket.deserializeAttachment() || {}) as { role?: string };
      socket.send(meta.role === "host" ? full : pub);
    }
  }
}
