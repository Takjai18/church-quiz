import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyIntent, createRoomState, isIdle, randomHostToken, tickRoom, type StoredRoom } from "./rooms";
import type { HostIntent, RoomState } from "../shared/types";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const dataFile = path.join(dataDir, "rooms.json");

const rooms = new Map<string, StoredRoom>();

function persist() {
  fs.mkdirSync(dataDir, { recursive: true });
  const payload = [...rooms.entries()].map(([code, stored]) => ({
    code,
    hostToken: stored.hostToken,
    room: stored.room,
  }));
  fs.writeFileSync(dataFile, JSON.stringify(payload));
}

function load() {
  try {
    if (!fs.existsSync(dataFile)) return;
    const raw = JSON.parse(fs.readFileSync(dataFile, "utf8")) as Array<{
      code: string;
      hostToken: string;
      room: RoomState;
    }>;
    const now = Date.now();
    for (const row of raw) {
      if (!row?.room?.code || isIdle(row.room, now)) continue;
      rooms.set(row.room.code, { room: row.room, hostToken: row.hostToken });
    }
  } catch {
    // start empty
  }
}

load();

export function createStoredRoom(teamA?: string, teamB?: string): StoredRoom {
  for (let i = 0; i < 20; i++) {
    const room = createRoomState({ teamA, teamB });
    if (!rooms.has(room.code)) {
      const stored = { room, hostToken: randomHostToken() };
      rooms.set(room.code, stored);
      persist();
      return stored;
    }
  }
  throw new Error("未能產生房號");
}

export function getStored(code: string): StoredRoom | undefined {
  return rooms.get(code.toUpperCase());
}

export function mutate(code: string, hostToken: string, intent: HostIntent, now = Date.now()): RoomState {
  const stored = getStored(code);
  if (!stored) throw new Error("搵唔到呢房");
  if (stored.hostToken !== hostToken) throw new Error("主持權限唔啱");
  applyIntent(stored.room, intent, now);
  persist();
  return stored.room;
}

export function tickAll(now = Date.now()): RoomState[] {
  const changed: RoomState[] = [];
  for (const [code, stored] of rooms) {
    if (isIdle(stored.room, now)) {
      rooms.delete(code);
      continue;
    }
    if (tickRoom(stored.room, now)) changed.push(stored.room);
  }
  if (changed.length) persist();
  return changed;
}

export function allRooms(): StoredRoom[] {
  return [...rooms.values()];
}
