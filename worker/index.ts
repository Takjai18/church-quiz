import { QuizRoom } from "./room";
import { randomCode } from "../shared/game";

export { QuizRoom };

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({ ok: true });
    }

    if (request.method === "GET" && url.pathname === "/api/info") {
      return json({ origin: url.origin, lan: [] });
    }

    if (request.method === "POST" && url.pathname === "/api/rooms") {
      const body = (await request.json().catch(() => ({}))) as { teamA?: string; teamB?: string };
      for (let i = 0; i < 24; i++) {
        const code = randomCode();
        const stub = env.ROOM.getByName(code);
        const created = await stub.tryCreate(body.teamA || "紅隊", body.teamB || "藍隊", code);
        if (created.ok) {
          return json({ roomCode: code, hostToken: created.hostToken, room: created.room });
        }
      }
      return json({ error: "未能產生房號" }, 500);
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/room/")) {
      const code = url.pathname.slice("/api/room/".length).toUpperCase();
      const snap = await env.ROOM.getByName(code).publicSnapshot();
      if (!snap) return json({ error: "搵唔到呢房" }, 404);
      return json(snap);
    }

    const uploadMatch = /^\/uploads\/([A-Z0-9]{4})\/([a-z0-9]+)$/i.exec(url.pathname);
    if (request.method === "GET" && uploadMatch) {
      const img = await env.ROOM.getByName(uploadMatch[1]!.toUpperCase()).getImage(uploadMatch[2]!);
      if (!img) return new Response("not found", { status: 404 });
      return new Response(img.data, {
        headers: { "Content-Type": img.mime, "Cache-Control": "public, max-age=31536000" },
      });
    }

    if (request.method === "POST" && url.pathname === "/api/upload") {
      const body = (await request.json().catch(() => ({}))) as { dataUrl?: string; roomCode?: string };
      const token = request.headers.get("X-Host-Token") || "";
      const code = String(body.roomCode || "").toUpperCase();
      const dataUrl = String(body.dataUrl || "");
      const match = /^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl);
      if (!code || !token) return json({ error: "缺房號或權限" }, 400);
      if (!match) return json({ error: "只接受圖片" }, 400);
      const mime = `image/${match[1] === "jpg" ? "jpeg" : match[1]!.toLowerCase()}`;
      const binary = Uint8Array.from(atob(match[2]!), (c) => c.charCodeAt(0));
      if (binary.byteLength > 3_000_000) return json({ error: "圖片太大（上限約 3MB）" }, 400);
      try {
        const saved = await env.ROOM.getByName(code).putImage(token, mime, binary.buffer);
        return json(saved);
      } catch (err) {
        return json({ error: err instanceof Error ? err.message : "上傳失敗" }, 403);
      }
    }

    if (url.pathname.startsWith("/ws/")) {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket", { status: 426 });
      }
      const code = url.pathname.slice("/ws/".length).split("/")[0]?.toUpperCase() || "";
      if (code.length !== 4) return new Response("bad room", { status: 400 });
      return env.ROOM.getByName(code).fetch(request);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
