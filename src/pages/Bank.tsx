import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ASK_FOR_LABEL, CATEGORY_LABEL, cellKey } from "../../shared/labels";
import { CATEGORIES, POINT_VALUES, type AskFor, type Category, type Points, type Question } from "../../shared/types";
import { loadHostSession, saveLocalBank } from "../lib/storage";
import type { BankSnapshot } from "../../shared/types";

const ASK_OPTIONS: AskFor[] = ["text", "song", "title", "character", "punchline"];

const emptyForm = (): Partial<Question> & { category: Category; points: Points; askFor: AskFor } => ({
  category: "bible",
  points: 10,
  askFor: "text",
  prompt: "",
  answer: "",
  accept: [],
  hostNote: "",
  imageUrl: "",
});

export default function Bank() {
  const [tab, setTab] = useState<"enter" | "pick">("enter");
  const [data, setData] = useState<BankSnapshot | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [sortCat, setSortCat] = useState<Category | "all">("all");

  async function reload() {
    const res = await fetch("/api/bank");
    const body = (await res.json()) as BankSnapshot & { error?: string };
    if (!res.ok) throw new Error(body.error || "載入失敗");
    setData(body);
    return body;
  }

  useEffect(() => {
    void reload().catch((err: Error) => setError(err.message));
  }, []);

  const spareList = useMemo(() => {
    const catOrder = new Map(CATEGORIES.map((c, i) => [c, i]));
    const ptsOrder = new Map(POINT_VALUES.map((p, i) => [p, i]));
    const list = [...(data?.questions || [])].sort((a, b) => {
      const c = (catOrder.get(a.category) ?? 0) - (catOrder.get(b.category) ?? 0);
      if (c !== 0) return c;
      const p = (ptsOrder.get(a.points) ?? 0) - (ptsOrder.get(b.points) ?? 0);
      if (p !== 0) return p;
      return a.prompt.localeCompare(b.prompt, "zh-Hant");
    });
    if (sortCat === "all") return list;
    return list.filter((q) => q.category === sortCat);
  }, [data, sortCat]);

  const byCell = useMemo(() => {
    const map: Record<string, Question[]> = {};
    for (const q of data?.questions || []) {
      const k = cellKey(q.category, q.points);
      (map[k] ||= []).push(q);
    }
    return map;
  }, [data]);

  async function submitQuestion(e: FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    setSaving(true);
    try {
      const res = await fetch("/api/bank/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          accept: form.accept || [],
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "儲存失敗");
      setData(body);
      setForm(emptyForm());
      setOk(form.id ? "已更新備用題" : "已加入題庫備用");
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("刪除呢題備用？")) return;
    const res = await fetch(`/api/bank/questions/${encodeURIComponent(id)}`, { method: "DELETE" });
    setData(await res.json());
  }

  async function uploadImage(file: File) {
    const dataUrl = await readDataUrl(file);
    const res = await fetch("/api/bank/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "上傳失敗");
    setForm((f) => ({ ...f, imageUrl: body.url as string }));
  }

  async function pickCell(cell: string, questionId: string) {
    if (!data) return;
    const lineup = { ...data.lineup, [cell]: questionId };
    const res = await fetch("/api/bank/lineup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineup }),
    });
    const next = (await res.json()) as BankSnapshot;
    setData(next);
    if (next.selected) saveLocalBank("青年小組冰破", next.selected);
  }

  async function applyToRoom() {
    setError("");
    setOk("");
    const snap = await reload();
    if (!snap.selected) {
      setError("請先喺「揀題」揀齊 12 格");
      return;
    }
    saveLocalBank("青年小組冰破", snap.selected);
    const session = loadHostSession();
    if (!session) {
      setOk("已儲存揀題。返去主持台開房就會用呢 12 題。");
      return;
    }
    const res = await fetch(`/api/rooms/${session.roomCode}/intent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Host-Token": session.hostToken,
      },
      body: JSON.stringify({ intent: { type: "loadBank", title: "青年小組冰破", questions: snap.selected } }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error || "套用失敗（開場後唔改到，請未開場先套用）");
      return;
    }
    setOk(`已套用到房號 ${session.roomCode}`);
  }

  return (
    <div className="page bank-page">
      <header className="host-bar">
        <div>
          <p className="eyebrow">題庫</p>
          <h1>入題同揀題</h1>
        </div>
        <div className="host-bar-actions">
          <Link className="btn ghost" to="/host">
            返回主持台
          </Link>
        </div>
      </header>

      <div className="mode-switch" role="tablist">
        <button type="button" className={`btn ${tab === "enter" ? "primary" : "ghost"}`} onClick={() => setTab("enter")}>
          入題（備用）
        </button>
        <button type="button" className={`btn ${tab === "pick" ? "primary" : "ghost"}`} onClick={() => setTab("pick")}>
          揀題（出賽 12 格）
        </button>
      </div>

      {error ? <p className="error banner">{error}</p> : null}
      {ok ? <p className="ok">{ok}</p> : null}

      {tab === "enter" ? (
        <div className="lobby-grid">
          <section className="panel">
            <h2>{form.id ? "改備用題" : "新增備用題"}</h2>
            <form onSubmit={submitQuestion}>
              <label>
                類別
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                分數
                <select
                  value={form.points}
                  onChange={(e) => setForm({ ...form, points: Number(e.target.value) as Points })}
                >
                  {POINT_VALUES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                題型
                <select
                  value={form.askFor}
                  onChange={(e) => setForm({ ...form, askFor: e.target.value as AskFor })}
                >
                  {ASK_OPTIONS.map((k) => (
                    <option key={k} value={k}>
                      {ASK_FOR_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                題目
                <textarea rows={3} value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} required />
              </label>
              <label>
                答案
                <input value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} required />
              </label>
              <label>
                可接受（逗號分隔）
                <input
                  value={(form.accept || []).join("、")}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      accept: e.target.value
                        .split(/[、,，]/)
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
              <label>
                主持備註
                <input value={form.hostNote || ""} onChange={(e) => setForm({ ...form, hostNote: e.target.value })} />
              </label>
              {(form.category === "kdrama" || form.imageUrl) && (
                <div className="img-edit">
                  {form.imageUrl ? <img src={form.imageUrl} alt="" /> : <em>未有圖</em>}
                  <input
                    placeholder="圖片網址"
                    value={form.imageUrl || ""}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  />
                  <label className="btn tiny">
                    上傳劇照
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void uploadImage(file).catch((err: Error) => setError(err.message));
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              )}
              <div className="choice-row">
                <button className="btn primary" type="submit" disabled={saving}>
                  {form.id ? "更新" : "加入備用"}
                </button>
                {form.id ? (
                  <button className="btn ghost" type="button" onClick={() => setForm(emptyForm())}>
                    取消改題
                  </button>
                ) : null}
              </div>
            </form>
          </section>
          <section className="panel">
            <h2>備用題（{spareList.length}{sortCat === "all" ? `／${data?.questions.length ?? 0}` : ""}）</h2>
            <label>
              按類別
              <select value={sortCat} onChange={(e) => setSortCat(e.target.value as Category | "all")}>
                <option value="all">全部（聖經 → 流行曲 → 韓劇 → 冷笑話）</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </label>
            <ul className="bank-list">
              {spareList.map((q, i) => {
                const prev = spareList[i - 1];
                const showHead = sortCat === "all" && q.category !== prev?.category;
                return (
                  <li key={q.id}>
                    {showHead ? <p className="spare-head">{CATEGORY_LABEL[q.category]}</p> : null}
                    <strong>
                      {CATEGORY_LABEL[q.category]} {q.points}
                    </strong>
                    <span>{q.prompt}</span>
                    <div className="choice-row">
                      <button className="btn tiny" type="button" onClick={() => setForm({ ...q, askFor: q.askFor || "text" })}>
                        改
                      </button>
                      <button className="btn tiny" type="button" onClick={() => void remove(q.id)}>
                        刪
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      ) : (
        <section className="panel">
          <h2>揀今場 12 格</h2>
          <p className="hint">每個類別每個分數揀一題出賽。其餘留喺資料庫備用。</p>
          <div className="pick-grid">
            {CATEGORIES.map((c) => (
              <div key={c} className="pick-col">
                <h3>{CATEGORY_LABEL[c]}</h3>
                {POINT_VALUES.map((p) => {
                  const cell = cellKey(c, p);
                  const options = byCell[cell] || [];
                  return (
                    <label key={cell}>
                      {p} 分（備用 {options.length}）
                      <select
                        value={data?.lineup[cell] || ""}
                        onChange={(e) => void pickCell(cell, e.target.value)}
                      >
                        <option value="">未揀</option>
                        {options.map((q) => (
                          <option key={q.id} value={q.id}>
                            {q.prompt.slice(0, 36)}
                            {q.prompt.length > 36 ? "…" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
          <p className={data?.selected ? "ok" : "error"}>{data?.selected ? "12 格已揀齊" : "未揀齊 12 格"}</p>
          <button className="btn primary huge-btn wide" type="button" disabled={!data?.selected} onClick={() => void applyToRoom()}>
            套用到主持台呢房
          </button>
        </section>
      )}
    </div>
  );
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
