import { POINT_VALUES, type BankValidation, type Category, type Points, type Question } from "./types";
import { categoryLabel, cellKey } from "./labels";

const PTS = new Set<number>(POINT_VALUES);

export function normalizeQuestion(raw: unknown, index: number): Question {
  if (!raw || typeof raw !== "object") {
    throw new Error(`第 ${index + 1} 題格式無效`);
  }
  const q = raw as Record<string, unknown>;
  const category = String(q.category ?? "").trim();
  const points = Number(q.points);
  if (!category) {
    throw new Error(`第 ${index + 1} 題缺少類別`);
  }
  if (!PTS.has(points)) {
    throw new Error(`第 ${index + 1} 題分數無效：${q.points}`);
  }
  const accept = Array.isArray(q.accept)
    ? q.accept.map((x) => String(x).trim()).filter(Boolean)
    : [];
  const prompt = String(q.prompt ?? "").trim();
  const answer = String(q.answer ?? "").trim();
  if (!prompt) throw new Error(`第 ${index + 1} 題缺少題目`);
  if (!answer) throw new Error(`第 ${index + 1} 題缺少答案`);
  const askFor = q.askFor ? String(q.askFor) : undefined;
  return {
    id: String(q.id ?? `${category}-${points}`),
    category: category as Category,
    points: points as Points,
    prompt,
    answer,
    accept,
    hostNote: q.hostNote ? String(q.hostNote) : undefined,
    imageUrl: q.imageUrl ? String(q.imageUrl) : undefined,
    askFor: askFor as Question["askFor"],
  };
}

export function categoriesInQuestions(questions: Question[]): Category[] {
  const ids: Category[] = [];
  for (const q of questions) {
    if (!ids.includes(q.category)) ids.push(q.category);
  }
  return ids;
}

export function validateBank(questions: Question[]): BankValidation {
  const errors: string[] = [];
  const missing: string[] = [];
  const cats = categoriesInQuestions(questions);
  const expected = cats.length * POINT_VALUES.length;
  if (!cats.length) {
    errors.push("未有類別");
  }
  if (questions.length !== expected) {
    errors.push(`需要剛好 ${expected} 題（${cats.length} 類 × 3 分值），而家有 ${questions.length} 題`);
  }
  const seen = new Map<string, Question>();
  for (const q of questions) {
    const key = cellKey(q.category, q.points);
    if (seen.has(key)) {
      errors.push(`重複格子：${categoryLabel(q.category)} ${q.points}`);
    }
    seen.set(key, q);
  }
  for (const c of cats) {
    for (const p of POINT_VALUES) {
      if (!seen.has(cellKey(c, p))) {
        missing.push(`${categoryLabel(c)} ${p}`);
      }
    }
  }
  if (missing.length) {
    errors.push(`缺少：${missing.join("、")}`);
  }
  return {
    ok: errors.length === 0 && missing.length === 0 && questions.length === expected && expected > 0,
    errors,
    missing,
  };
}

export function parseBankJson(text: string): { title?: string; questions: Question[] } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("JSON 格式錯誤，未能解析");
  }
  if (!data || typeof data !== "object") throw new Error("JSON 內容無效");
  const obj = data as { title?: unknown; questions?: unknown };
  if (!Array.isArray(obj.questions)) throw new Error("缺少 questions 陣列");
  return {
    title: obj.title ? String(obj.title) : undefined,
    questions: obj.questions.map((q, i) => normalizeQuestion(q, i)),
  };
}
