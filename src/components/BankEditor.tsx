import { ASK_FOR_LABEL, CATEGORY_LABEL } from "../../shared/labels";
import type { AskFor, Question } from "../../shared/types";

const ASK_OPTIONS: AskFor[] = ["text", "song", "title", "character", "punchline"];

export default function BankEditor({
  questions,
  onChange,
  onUploadImage,
}: {
  questions: Question[];
  onChange: (questions: Question[]) => void;
  onUploadImage: (questionId: string, file: File) => Promise<void>;
}) {
  function patch(id: string, partial: Partial<Question>) {
    onChange(questions.map((q) => (q.id === id ? { ...q, ...partial } : q)));
  }

  return (
    <ul className="bank-list editor">
      {questions.map((item) => (
        <li key={item.id} className="q-edit">
          <strong>
            {CATEGORY_LABEL[item.category]} {item.points}
          </strong>
          <label>
            題型
            <select
              value={item.askFor || "text"}
              onChange={(e) => patch(item.id, { askFor: e.target.value as AskFor })}
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
            <textarea rows={2} value={item.prompt} onChange={(e) => patch(item.id, { prompt: e.target.value })} />
          </label>
          <label>
            答案
            <input value={item.answer} onChange={(e) => patch(item.id, { answer: e.target.value })} />
          </label>
          <label>
            可接受（逗號分隔）
            <input
              value={item.accept.join("、")}
              onChange={(e) =>
                patch(item.id, {
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
            <input value={item.hostNote || ""} onChange={(e) => patch(item.id, { hostNote: e.target.value })} />
          </label>
          {item.category === "kdrama" || item.imageUrl ? (
            <div className="img-edit">
              {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <em>未有圖</em>}
              <input
                placeholder="圖片網址"
                value={item.imageUrl || ""}
                onChange={(e) => patch(item.id, { imageUrl: e.target.value })}
              />
              <label className="btn tiny">
                上傳劇照
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onUploadImage(item.id, file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          ) : (
            <label className="btn tiny">
              加圖片
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onUploadImage(item.id, file);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </li>
      ))}
    </ul>
  );
}
