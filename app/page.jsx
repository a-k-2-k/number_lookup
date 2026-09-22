"use client";
import { useEffect, useState } from "react";

export default function Home() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null); // { done, total }
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]); // results, newest lookups merged in

  // Load saved results so a personal contact list builds up over time.
  useEffect(() => {
    try {
      setRows(JSON.parse(localStorage.getItem("lookups") || "[]"));
    } catch {}
  }, []);

  function persist(next) {
    setRows(next);
    try {
      localStorage.setItem("lookups", JSON.stringify(next.slice(0, 500)));
    } catch {}
  }

  // Merge new results into existing rows, keyed by phone (newest wins).
  function mergeResults(results) {
    const byPhone = new Map(rows.map((r) => [r.phone, r]));
    for (const r of results) byPhone.set(r.phone, { ...r, at: Date.now() });
    // Found rows first, then unmatched, most recent within each group.
    const merged = Array.from(byPhone.values()).sort((a, b) => {
      if (!!b.found !== !!a.found) return b.found ? 1 : -1;
      return (b.at || 0) - (a.at || 0);
    });
    persist(merged);
  }

  async function lookup() {
    const body = text.trim();
    if (!body) return;
    setLoading(true);
    setError("");
    setProgress(null);
    try {
      const r = await fetch("/api/lookup/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Something broke");
      setProgress({ done: data.found, total: data.count });
      mergeResults(data.results);
      setText("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function removeRow(phone) {
    persist(rows.filter((r) => r.phone !== phone));
  }

  function clearAll() {
    if (confirm("Clear all saved lookups?")) persist([]);
  }

  function exportCsv() {
    const cols = ["name", "phone", "title", "company", "location", "linkedin"];
    const csvRows = rows.map((h) =>
      cols.map((c) => `"${String(h[c] || "").replace(/"/g, '""')}"`).join(",")
    );
    const blob = new Blob([[cols.join(","), ...csvRows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "contacts.csv";
    a.click();
  }

  const linkFor = (r) => r.linkedin || r.linkedinSearch;

  return (
    <main>
      <h1>Number Lookup</h1>
      <p className="sub">
        Paste phone numbers (one per line, or a whole chat export). Get names and LinkedIn profiles.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          lookup();
        }}
      >
        <textarea
          autoFocus
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"+1 (510) 555-1234\n+1 415 555 9876\n5105550000"}
        />
        <div className="row">
          <button disabled={loading}>
            {loading ? "Looking up..." : "Look up all"}
          </button>
          {progress && !loading && (
            <span className="small">
              matched {progress.done} of {progress.total}
            </span>
          )}
        </div>
      </form>

      {error && <div className="card err">{error}</div>}

      {rows.length > 0 && (
        <section>
          <div className="histhead">
            <h2>Contacts ({rows.length})</h2>
            <div className="row">
              <button className="link" onClick={exportCsv}>Export CSV</button>
              <button className="link" onClick={clearAll}>Clear</button>
            </div>
          </div>
          <table className="results">
            <thead>
              <tr>
                <th>Name</th>
                <th>Company / Title</th>
                <th>Location</th>
                <th>Phone</th>
                <th>LinkedIn</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.phone} className={r.found ? "" : "muted"}>
                  <td>{r.name || (r.found ? "Unknown" : "No match")}</td>
                  <td>{[r.company, r.title].filter(Boolean).join(" · ") || "—"}</td>
                  <td>{r.location || "—"}</td>
                  <td className="mono">{r.phone}</td>
                  <td>
                    {linkFor(r) ? (
                      <a href={linkFor(r)} target="_blank" rel="noreferrer">
                        {r.linkedin ? "Profile" : "Search"}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <button className="link" onClick={() => removeRow(r.phone)}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
