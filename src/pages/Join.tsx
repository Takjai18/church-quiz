import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Join() {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const nav = useNavigate();

  function submit(e: FormEvent) {
    e.preventDefault();
    const c = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (c.length !== 4) {
      setErr("請輸入 4 位房號");
      return;
    }
    nav(`/play/${c}`);
  }

  return (
    <div className="page join-page">
      <div className="join-card">
        <p className="eyebrow">教會冰破</p>
        <h1>問答擂台</h1>
        <p className="lede">輸入房號，同場睇題同分數。唔使撳鈴，亦唔使登入。</p>
        <form onSubmit={submit}>
          <label htmlFor="code">房號</label>
          <input
            id="code"
            className="code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={4}
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="ABCD"
          />
          {err ? <p className="error">{err}</p> : null}
          <button className="btn primary wide" type="submit">
            進入房間
          </button>
        </form>
        <Link className="host-link" to="/host">
          我係主持，開新房
        </Link>
      </div>
    </div>
  );
}
