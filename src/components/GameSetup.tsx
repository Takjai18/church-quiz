import { useMemo } from "react";
import { POINT_VALUES, type BankSnapshot, type CategoryDef } from "../../shared/types";

export type CatSetup = {
  id: string;
  label: string;
  on: boolean;
  count: number;
  points: number[];
};

export function buildGamePayload(setup: CatSetup[], bank: BankSnapshot | null) {
  const selected = setup.filter((c) => c.on);
  const categories: CategoryDef[] = selected.map((c) => ({ id: c.id, label: c.label }));
  const slots: { category: string; slot: number; points: number; questionId: string }[] = [];
  const questions = [];
  const seen = new Set<string>();
  for (const c of selected) {
    const pool = (bank?.questions || []).filter((q) => q.category === c.id);
    const lined = [10, 30, 50]
      .map((p) => bank?.lineup?.[`${c.id}-${p}`])
      .map((id) => pool.find((q) => q.id === id))
      .filter(Boolean);
    const rest = pool.filter((q) => !lined.some((x) => x && x.id === q.id));
    const ordered = [...lined, ...rest] as typeof pool;
    for (let i = 0; i < c.count; i++) {
      const q = ordered[i];
      if (!q) continue;
      slots.push({ category: c.id, slot: i, points: c.points[i] ?? 10, questionId: q.id });
      if (!seen.has(q.id)) {
        seen.add(q.id);
        questions.push(q);
      }
    }
  }
  return { categories, slots, questions };
}

export function defaultCatSetup(categories: CategoryDef[]): CatSetup[] {
  return categories.map((c) => ({
    id: c.id,
    label: c.label,
    on: true,
    count: 3,
    points: [...POINT_VALUES],
  }));
}

function resizePoints(prev: number[], count: number): number[] {
  const next = prev.slice(0, count);
  while (next.length < count) {
    const i = next.length;
    next.push(POINT_VALUES[i] ?? (i + 1) * 10);
  }
  return next;
}

export default function GameSetup({
  setup,
  onChange,
  bank,
}: {
  setup: CatSetup[];
  onChange: (setup: CatSetup[]) => void;
  bank: BankSnapshot | null;
}) {
  const onCount = setup.filter((c) => c.on).length;
  const qCount = setup.filter((c) => c.on).reduce((n, c) => n + c.count, 0);

  const warnings = useMemo(() => {
    if (!bank) return [] as string[];
    const msgs: string[] = [];
    for (const c of setup.filter((x) => x.on)) {
      const have = bank.questions.filter((q) => q.category === c.id).length;
      if (have < c.count) msgs.push(`${c.label} 備用只有 ${have} 題，你設咗 ${c.count} 題`);
    }
    return msgs;
  }, [bank, setup]);

  function patch(id: string, partial: Partial<CatSetup>) {
    onChange(
      setup.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...partial };
        if (partial.count != null) next.points = resizePoints(c.points, partial.count);
        return next;
      }),
    );
  }

  return (
    <section className="panel">
      <h2>今場棋盤</h2>
      <p className="hint">揀今次用幾種題型、每種幾多題。超過 3 題可以自訂每題分數。</p>
      <p className="ok">
        {onCount} 種題型 · {qCount} 題
      </p>
      {setup.map((c) => (
        <div key={c.id} className="setup-cat">
          <label className="setup-on">
            <input type="checkbox" checked={c.on} onChange={(e) => patch(c.id, { on: e.target.checked })} />
            {c.label}
          </label>
          {c.on ? (
            <>
              <label>
                題數
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={c.count}
                  onChange={(e) => patch(c.id, { count: Math.max(1, Math.min(8, Number(e.target.value) || 1)) })}
                />
              </label>
              <div className="setup-points">
                {c.points.map((pts, i) => (
                  <label key={i}>
                    第 {i + 1} 題分數
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={pts}
                      onChange={(e) => {
                        const points = c.points.slice();
                        points[i] = Math.max(1, Number(e.target.value) || 1);
                        patch(c.id, { points });
                      }}
                    />
                  </label>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ))}
      {warnings.map((w) => (
        <p key={w} className="error">
          {w}
        </p>
      ))}
    </section>
  );
}
