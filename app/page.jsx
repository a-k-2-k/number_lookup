"use client";
import { useEffect, useRef, useState } from "react";
import { extractNumbers, fixOcrDigits } from "../lib/phone.js";

export default function Home() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null); // { done, total }
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]); // results, newest lookups merged in
  const [ocr, setOcr] = useState(null); // { file, of, pct } while reading screenshots
  const [ocrNote, setOcrNote] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef(null);
  const workerRef = useRef(null);

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

  // OCR screenshots in the browser (Tesseract), then drop the numbers found
  // into the textarea so they can be reviewed before looking them up.
  async function readImages(files) {
    if (ocr) return;
    const images = Array.from(files || []).filter(
      (f) => f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name)
    );
    if (images.length === 0) {
      setError("That wasn't an image file. Drag in a screenshot (PNG or JPG).");
      return;
    }
    setError("");
    setOcrNote("");
    setOcr({ file: 1, of: images.length, pct: 0 });
    try {
      if (!workerRef.current) {
        const { createWorker } = await import("tesseract.js");
        workerRef.current = await createWorker("eng", 1, {
          logger: (m) => {
            if (m.status === "recognizing text") {
              setOcr((o) => (o ? { ...o, pct: Math.round(m.progress * 100) } : o));
            }
          },
        });
      }
      const found = [];
      for (let i = 0; i < images.length; i++) {
        setOcr({ file: i + 1, of: images.length, pct: 0 });
        const { data } = await workerRef.current.recognize(images[i]);
        found.push(...extractNumbers(fixOcrDigits(data.text)));
      }
      const existing = new Set(extractNumbers(text));
      const fresh = [...new Set(found)].filter((n) => !existing.has(n));
      if (fresh.length) setText((t) => [t.trim(), ...fresh].filter(Boolean).join("\n"));
      const label = images.length === 1 ? "screenshot" : `${images.length} screenshots`;
      setOcrNote(
        found.length === 0
          ? `No phone numbers found in ${label}.`
          : `Found ${fresh.length} new number${fresh.length === 1 ? "" : "s"} in ${label}. Check them, then look up.`
      );
    } catch (e) {
      setError("Couldn't read image: " + e.message);
    } finally {
      setOcr(null);
    }
  }

  // Cmd/Ctrl+V a screenshot anywhere on the page.
  useEffect(() => {
    function onPaste(e) {
      const files = Array.from(e.clipboardData?.files || []);
      if (files.some((f) => f.type.startsWith("image/"))) {
        e.preventDefault();
        readImages(files);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  // Drag screenshots anywhere on the page. Without this, dropping an image
  // outside the drop zone makes the browser navigate away to open it.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes("Files");
    function onEnter(e) {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    }
    function onOver(e) {
      if (hasFiles(e)) e.preventDefault();
    }
    function onLeave(e) {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    }
    function onDrop(e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      readImages(e.dataTransfer.files);
    }
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  });

  useEffect(() => () => workerRef.current?.terminate(), []);

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
        Drag in WhatsApp screenshots (or paste numbers / a chat export). Get names and LinkedIn
        profiles.
      </p>

      {dragging && (
        <div className="dropoverlay">
          <div>Drop screenshots to read the numbers</div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          lookup();
        }}
      >
        <div
          className={"dropzone" + (ocr ? " busy" : "")}
          role="button"
          tabIndex={0}
          onClick={() => !ocr && fileInput.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !ocr) {
              e.preventDefault();
              fileInput.current?.click();
            }
          }}
        >
          {ocr ? (
            <>
              <strong>
                Reading {ocr.of > 1 ? `screenshot ${ocr.file} of ${ocr.of}` : "screenshot"}… {ocr.pct}%
              </strong>
              <span className="small">The first one takes a few seconds to warm up</span>
            </>
          ) : (
            <>
              <strong>Drag WhatsApp screenshots here</strong>
              <span className="small">or click to choose files · or ⌘V to paste one</span>
            </>
          )}
        </div>
        <textarea
          autoFocus
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Numbers from screenshots show up here — or paste them yourself:\n+1 (510) 555-1234\n+1 415 555 9876"}
        />
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            readImages(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="row">
          <button disabled={loading || !!ocr}>
            {loading ? "Looking up..." : "Look up all"}
          </button>
          {progress && !loading && (
            <span className="small">
              matched {progress.done} of {progress.total}
            </span>
          )}
          {ocrNote && !ocr && !loading && <span className="small">{ocrNote}</span>}
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
