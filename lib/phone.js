// Handles WhatsApp formats like "+1 (510) 555-1234", "‪+1 510-555-1234‬", "5105551234"
export function normalizePhone(raw) {
  let digits = String(raw || "").replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = "+" + digits.slice(2);
  if (!digits.startsWith("+")) {
    const d = digits.replace(/\D/g, "");
    if (d.length === 10) return "+1" + d; // assume US
    if (d.length === 11 && d.startsWith("1")) return "+" + d;
    return "+" + d;
  }
  return "+" + digits.slice(1).replace(/\D/g, "");
}

export function linkedinSearchUrl(...terms) {
  const q = terms.filter(Boolean).join(" ");
  return q ? `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}` : null;
}

// Pull candidate phone numbers out of arbitrary pasted text.
// Handles one-per-line, comma/semicolon separated, and inline WhatsApp text.
// Shared by the bulk API route and the in-browser screenshot OCR.
export function extractNumbers(text) {
  const raw = String(text || "");
  // Match runs that look like phone numbers: optional +, digits, and the
  // usual separators (spaces/tabs, parens, dashes, dots) but NOT newlines,
  // so two numbers on adjacent lines never merge into one.
  const matches = raw.match(/\+?\d[\d \t().\-]{6,}\d/g) || [];
  const seen = new Set();
  const out = [];
  for (const m of matches) {
    const e164 = normalizePhone(m);
    if (e164.replace(/\D/g, "").length < 8) continue;
    if (seen.has(e164)) continue;
    seen.add(e164);
    out.push(e164);
  }
  return out;
}

// OCR often misreads digits as look-alike letters (O→0, l/I/|→1, S→5, B→8).
// Only fix those inside runs that are already mostly digits, so names and
// normal words in the screenshot are left alone.
export function fixOcrDigits(text) {
  return String(text || "").replace(/[+(]?\d[\dOoIl|SB \t().\-]{6,}[\d)]/g, (run) => {
    const digits = (run.match(/\d/g) || []).length;
    const lookalikes = (run.match(/[OoIl|SB]/g) || []).length;
    if (digits < 7 || lookalikes > 2) return run;
    return run
      .replace(/[Oo]/g, "0")
      .replace(/[Il|]/g, "1")
      .replace(/S/g, "5")
      .replace(/B/g, "8");
  });
}
