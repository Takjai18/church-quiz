import { DurableObject } from "cloudflare:workers";
import { DEMO_QUESTIONS } from "../shared/demo";
import { DEFAULT_CATEGORIES, POINT_VALUES, type BankSnapshot, type Category, type CategoryDef, type Points, type Question } from "../shared/types";
import { cellKey, slugCategory } from "../shared/labels";
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
      ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          sort INTEGER NOT NULL
        )
      `);
    });
  }

  private listCategories(): CategoryDef[] {
    const rows = this.ctx.storage.sql
      .exec<{ id: string; label: string }>("SELECT id, label FROM categories ORDER BY sort, id")
      .toArray();
    if (rows.length) return rows;
    for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
      const c = DEFAULT_CATEGORIES[i]!;
      this.ctx.storage.sql.exec("INSERT INTO categories (id, label, sort) VALUES (?, ?, ?)", c.id, c.label, i);
    }
    return DEFAULT_CATEGORIES.map((c) => ({ ...c }));
  }

  private seedIfEmpty() {
    this.listCategories();
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
    const categories = this.listCategories();
    const questions = this.ctx.storage.sql
      .exec<Record<string, unknown>>("SELECT * FROM questions ORDER BY category, points, createdAt")
      .toArray()
      .map(rowToQuestion);
    const lineup: Record<string, string> = {};
    for (const row of this.ctx.storage.sql.exec<{ cell: string; questionId: string }>("SELECT cell, questionId FROM lineup").toArray()) {
      lineup[row.cell] = row.questionId;
    }
    const selected: Question[] = [];
    for (const c of categories) {
      const ids = POINT_VALUES.map((p) => lineup[cellKey(c.id, p)]);
      if (!ids.every(Boolean)) continue;
      const qs = ids.map((id) => questions.find((q) => q.id === id));
      if (qs.every(Boolean)) selected.push(...(qs as Question[]));
    }
    const ok = selected.length > 0 && validateBank(selected).ok;
    return { questions, lineup, categories, selected: ok ? selected : null };
  }

  async addCategory(label: string) {
    this.seedIfEmpty();
    const name = label.trim();
    if (!name) throw new Error("請輸入類別名稱");
    const id = slugCategory(name);
    const exists = this.ctx.storage.sql.exec<{ id: string }>("SELECT id FROM categories WHERE id = ?", id).toArray()[0];
    if (exists) throw new Error("呢個類別已經有");
    const max = this.ctx.storage.sql.exec<{ n: number }>("SELECT COALESCE(MAX(sort), -1) AS n FROM categories").one();
    this.ctx.storage.sql.exec("INSERT INTO categories (id, label, sort) VALUES (?, ?, ?)", id, name, (max?.n ?? -1) + 1);
    return this.snapshot();
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
    const cats = this.listCategories();
    for (const c of cats) {
      for (const p of POINT_VALUES) {
        const key = cellKey(c.id, p);
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
