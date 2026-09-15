import { DurableObject } from "cloudflare:workers";
import { DEMO_QUESTIONS } from "../shared/demo";
import { CATEGORIES, POINT_VALUES, type BankSnapshot, type Category, type Points, type Question } from "../shared/types";
import { cellKey } from "../shared/labels";
import { normalizeQuestion, validateBank } from "../shared/validate";

function rowToQuestion(row: Record<string, unknown>): Question {
  let accept: string[] = [];
  try {
    accept = JSON.parse(String(row.accept || "[]")) as string[];
  } catch {
    accept = [];
  }
  return {
    id: String(row.id),
    category: row.category as Category,
    points: Number(row.points) as Points,
    prompt: String(row.prompt),
    answer: String(row.answer),
    accept,
    hostNote: row.hostNote ? String(row.hostNote) : undefined,
    imageUrl: row.imageUrl ? String(row.imageUrl) : undefined,
    askFor: row.askFor ? (String(row.askFor) as Question["askFor"]) : undefined,
  };
}

export class QuizBank extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS questions (
          id TEXT PRIMARY KEY,
          category TEXT NOT NULL,
          points INTEGER NOT NULL,
          prompt TEXT NOT NULL,
          answer TEXT NOT NULL,
          accept TEXT NOT NULL,
          hostNote TEXT,
          imageUrl TEXT,
          askFor TEXT,
          createdAt INTEGER NOT NULL
        )
      `);
      ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS lineup (
          cell TEXT PRIMARY KEY,
          questionId TEXT NOT NULL
        )
      `);
      ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS images (
          id TEXT PRIMARY KEY,
          mime TEXT NOT NULL,
          data BLOB NOT NULL
        )
      `);
    });
  }

  private seedIfEmpty() {
    const count = this.ctx.storage.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM questions").one();
    if ((count?.n ?? 0) > 0) return;
    const now = Date.now();
    for (const q of DEMO_QUESTIONS) {
      this.insertQuestion(q, now);
      this.ctx.storage.sql.exec(
        "INSERT INTO lineup (cell, questionId) VALUES (?, ?)",
        cellKey(q.category, q.points),
        q.id,
      );
    }
  }

  private insertQuestion(q: Question, now = Date.now()) {
    this.ctx.storage.sql.exec(
      `INSERT INTO questions (id, category, points, prompt, answer, accept, hostNote, imageUrl, askFor, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      q.id,
      q.category,
      q.points,
      q.prompt,
      q.answer,
      JSON.stringify(q.accept),
      q.hostNote ?? null,
      q.imageUrl ?? null,
      q.askFor ?? null,
      now,
    );
  }

  async snapshot(): Promise<BankSnapshot> {
    this.seedIfEmpty();
    const questions = this.ctx.storage.sql
      .exec<Record<string, unknown>>("SELECT * FROM questions ORDER BY category, points, createdAt")
      .toArray()
      .map(rowToQuestion);
    const lineup: Record<string, string> = {};
    for (const row of this.ctx.storage.sql.exec<{ cell: string; questionId: string }>("SELECT cell, questionId FROM lineup").toArray()) {
      lineup[row.cell] = row.questionId;
    }
    const selectedIds = CATEGORIES.flatMap((c) => POINT_VALUES.map((p) => lineup[cellKey(c, p)]));
    const selected =
      selectedIds.every(Boolean) && selectedIds.length === 12
        ? selectedIds.map((id) => questions.find((q) => q.id === id)).filter((q): q is Question => Boolean(q))
        : null;
    const ok = selected ? validateBank(selected).ok : false;
    return { questions, lineup, selected: ok && selected && selected.length === 12 ? selected : null };
  }

  async upsertQuestion(raw: unknown): Promise<Question> {
    this.seedIfEmpty();
    const obj = raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
    if (!obj.id) obj.id = crypto.randomUUID();
    const q = normalizeQuestion(obj, 0);
    const existing = this.ctx.storage.sql.exec<{ id: string }>("SELECT id FROM questions WHERE id = ?", q.id).toArray()[0];
    if (existing) {
      this.ctx.storage.sql.exec(
        `UPDATE questions SET category=?, points=?, prompt=?, answer=?, accept=?, hostNote=?, imageUrl=?, askFor=? WHERE id=?`,
        q.category,
        q.points,
        q.prompt,
        q.answer,
        JSON.stringify(q.accept),
        q.hostNote ?? null,
        q.imageUrl ?? null,
        q.askFor ?? null,
        q.id,
      );
    } else {
      this.insertQuestion(q);
    }
    return q;
  }

  async deleteQuestion(id: string) {
    this.ctx.storage.sql.exec("DELETE FROM questions WHERE id = ?", id);
    this.ctx.storage.sql.exec("DELETE FROM lineup WHERE questionId = ?", id);
  }

  async setLineup(lineup: Record<string, string>) {
    this.seedIfEmpty();
    this.ctx.storage.sql.exec("DELETE FROM lineup");
    for (const c of CATEGORIES) {
      for (const p of POINT_VALUES) {
        const key = cellKey(c, p);
        const qid = lineup[key];
        if (qid) this.ctx.storage.sql.exec("INSERT INTO lineup (cell, questionId) VALUES (?, ?)", key, qid);
      }
    }
    return this.snapshot();
  }

  async putImage(mime: string, data: ArrayBuffer) {
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    this.ctx.storage.sql.exec("INSERT INTO images (id, mime, data) VALUES (?, ?, ?)", id, mime, data);
    return { url: `/bank-img/${id}` };
  }

  async getImage(id: string): Promise<{ mime: string; data: ArrayBuffer } | null> {
    const row = this.ctx.storage.sql
      .exec<{ mime: string; data: ArrayBuffer }>("SELECT mime, data FROM images WHERE id = ?", id)
      .toArray()[0];
    return row ?? null;
  }
}

export function bankStub(env: Env) {
  return env.BANK.getByName("main");
}
