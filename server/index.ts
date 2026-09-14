import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import express from "express";
import { Server } from "socket.io";
import { createStoredRoom, getStored, mutate, tickAll } from "./store";
import { toPublicRoom } from "./rooms";
import type { HostIntent } from "../shared/types";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 3000);
const uploadsDir = path.join(root, "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();
app.use(express.json({ limit: "4mb" }));
app.use("/uploads", express.static(uploadsDir));
app.use(express.static(path.join(root, "public")));
const dist = path.join(root, "dist");
if (fs.existsSync(dist)) app.use(express.static(dist));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/info", (req, res) => {
  const host = req.headers.host || `127.0.0.1:${PORT}`;
  const proto = req.headers["x-forwarded-proto"] || "http";
  const lan: string[] = [];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === "IPv4" && !a.internal) lan.push(`http://${a.address}:${PORT}`);
    }
  }
  res.json({ port: PORT, host, origin: `${proto}://${host}`, lan });
});

app.post("/api/upload", (req, res) => {
  const dataUrl = String(req.body?.dataUrl || "");
  const match = /^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl);
  if (!match) {
    res.status(400).json({ error: "只接受圖片" });
    return;
  }
  const ext = match[1] === "jpeg" ? "jpg" : match[1]!.toLowerCase();
  const buf = Buffer.from(match[2]!, "base64");
  if (buf.length > 3_000_000) {
    res.status(400).json({ error: "圖片太大（上限約 3MB）" });
    return;
  }
  const id = randomBytes(8).toString("hex");
  const filename = `${id}.${ext}`;
  fs.writeFileSync(path.join(uploadsDir, filename), buf);
  res.json({ url: `/uploads/${filename}` });
});

app.get("/api/room/:code", (req, res) => {
  const stored = getStored(String(req.params.code));
  if (!stored) {
    res.status(404).json({ error: "搵唔到呢房" });
    return;
  }
  res.json(toPublicRoom(stored.room));
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true },
  maxHttpBufferSize: 1e6,
});

type Role = "host" | "display" | "play";

io.on("connection", (socket) => {
  socket.on("create", (payload?: { teamA?: string; teamB?: string }) => {
    try {
      const stored = createStoredRoom(payload?.teamA, payload?.teamB);
      socket.data.role = "host" as Role;
      socket.data.roomCode = stored.room.code;
      socket.data.hostToken = stored.hostToken;
      socket.join(roomHost(stored.room.code));
      socket.emit("created", {
        roomCode: stored.room.code,
        hostToken: stored.hostToken,
        room: stored.room,
      });
    } catch (err) {
      socket.emit("errorMsg", messageOf(err));
    }
  });

  socket.on("resume", (payload: { roomCode?: string; hostToken?: string }) => {
    try {
      const code = String(payload?.roomCode || "").toUpperCase();
      const stored = getStored(code);
      if (!stored) throw new Error("搵唔到呢房");
      if (stored.hostToken !== payload?.hostToken) throw new Error("主持權限唔啱");
      socket.data.role = "host" as Role;
      socket.data.roomCode = stored.room.code;
      socket.data.hostToken = stored.hostToken;
      socket.join(roomHost(stored.room.code));
      socket.emit("state", stored.room);
    } catch (err) {
      socket.emit("errorMsg", messageOf(err));
    }
  });

  socket.on("join", (payload: { roomCode?: string; role?: Role }) => {
    try {
      const code = String(payload?.roomCode || "").toUpperCase();
      const stored = getStored(code);
      if (!stored) throw new Error("搵唔到呢房");
      const role: Role = payload?.role === "display" ? "display" : "play";
      socket.data.role = role;
      socket.data.roomCode = stored.room.code;
      socket.join(roomPublic(stored.room.code));
      socket.emit("state", toPublicRoom(stored.room));
    } catch (err) {
      socket.emit("errorMsg", messageOf(err));
    }
  });

  socket.on("host", (intent: HostIntent) => {
    try {
      const code = socket.data.roomCode as string | undefined;
      const token = socket.data.hostToken as string | undefined;
      if (!code || !token || socket.data.role !== "host") {
        throw new Error("唔係主持");
      }
      const room = mutate(code, token, intent);
      broadcast(room.code);
    } catch (err) {
      socket.emit("errorMsg", messageOf(err));
    }
  });
});

function roomHost(code: string) {
  return `host:${code}`;
}
function roomPublic(code: string) {
  return `pub:${code}`;
}

function broadcast(code: string) {
  const stored = getStored(code);
  if (!stored) return;
  io.to(roomHost(code)).emit("state", stored.room);
  io.to(roomPublic(code)).emit("state", toPublicRoom(stored.room));
}

function messageOf(err: unknown) {
  return err instanceof Error ? err.message : "出錯";
}

setInterval(() => {
  const changed = tickAll();
  for (const room of changed) broadcast(room.code);
}, 200);

async function start() {
  if (fs.existsSync(path.join(dist, "index.html"))) {
    app.use(express.static(dist));
    app.get(/^\/(?!api\/|socket\.io\/|uploads\/|kdrama\/).*/, (req, res, next) => {
      if (req.method !== "GET") return next();
      res.sendFile(path.join(dist, "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      root,
      server: { middlewareMode: true, allowedHosts: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  await new Promise<void>((resolve) => {
    server.listen(PORT, "0.0.0.0", () => resolve());
  });
  const lan: string[] = [];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === "IPv4" && !a.internal) lan.push(`http://${a.address}:${PORT}`);
    }
  }
  console.log(`church-quiz listening on http://127.0.0.1:${PORT}`);
  for (const u of lan) console.log(`LAN ${u}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
