"use client";
import { useEffect, useState } from "react";

export default function Home() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem("lookups") || "[]"));
    } catch {}
  }, []);

  function save(entry) {
    const next = [entry, ...history.filter((h) => h.phone !== entry.phone)].slice(0, 50);
    setHistory(next);
    try {
      localStorage.setItem("lookups", JSON.stringify(next));
    } catch {}
  }

  async function lookup(value) {
    const p = (value ?? phone).trim();
    if (!p) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const r = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: p }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Something broke");
      setResult(data);
      if (data.found) save({ ...data, at: Date.now() });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    const cols = ["name", "phone", "title", "company", "location", "linkedin"];
    const rows = history.map((h) => cols.map((c) => `"${(h[c] || "").replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[cols.join(","), ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "leads.csv";
    a.click();
  }

  return (
    <main>
      <h1>Number Lookup</h1>
      <p className="sub">Paste a number from WhatsApp. Get the name and LinkedIn.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          lookup();
        }}
      >
        <input
          autoFocus
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onPaste={(e) => {
            const v = e.clipboardData.getData("text");
            setPhone(v);
            e.preventDefault();
            lookup(v);
          }}
          placeholder="+1 (510) 555-1234"
        />
        <button disabled={loading}>{loading ? "Looking..." : "Look up"}</button>
      </form>

      {error && <div className="card err">{error}</div>}

      {result && !result.found && (
        <div className="card">No match for {result.phone}.</div>
      )}

      {result?.found && (
        <div className="card">
          <div className="name">{result.name || "Unknown name"}</div>
          <div className="meta">
            {[result.title, result.company].filter(Boolean).join(" @ ")}
            {result.location && <span> · {result.location}</span>}
          </div>
          <div className="meta small">
            {result.phone} · match confidence {result.likelihood}/10
          </div>
          <div className="actions">
            {result.linkedin ? (
              <a className="btn primary" href={result.linkedin} target="_blank" rel="noreferrer">
                Open LinkedIn
              </a>
            ) : (
              result.linkedinSearch && (
                <a className="btn primary" href={result.linkedinSearch} target="_blank" rel="noreferrer">
                  Search LinkedIn
                </a>
              )
            )}
            <button className="btn" onClick={() => navigator.clipboard.writeText(result.name || "")}>
              Copy name
            </button>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <section>
          <div className="histhead">
            <h2>Recent</h2>
            <button className="link" onClick={exportCsv}>Export CSV</button>
          </div>
          <ul>
            {history.map((h) => (
              <li key={h.phone}>
                <button className="link" onClick={() => setResult(h)}>
                  {h.name || h.phone}
                </button>
                <span className="small">{h.company || ""}</span>
                {h.linkedin && (
                  <a href={h.linkedin} target="_blank" rel="noreferrer" className="small">
                    in
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
