// Bulk lookup: paste many numbers at once (e.g. a whole groupchat).
// Parses free-form text, extracts phone numbers, dedupes, and looks each up.
import { normalizePhone } from "../../../../lib/phone.js";
import { lookupOne, providersConfigured } from "../../../../lib/lookup.js";

// Pull candidate phone numbers out of arbitrary pasted text.
// Handles one-per-line, comma/semicolon separated, and inline WhatsApp text.
function extractNumbers(text) {
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

// Run lookups with a small concurrency cap so we don't hammer the APIs.
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function POST(req) {
  const { pdl, trestle } = providersConfigured();
  if (!pdl && !trestle) {
    return Response.json(
      { error: "No provider configured. Add PDL_API_KEY (and optionally TRESTLE_API_KEY) to .env.local" },
      { status: 500 }
    );
  }

  const { text } = await req.json().catch(() => ({}));
  const numbers = extractNumbers(text);
  if (numbers.length === 0) {
    return Response.json({ error: "No phone numbers found in that text" }, { status: 400 });
  }
  if (numbers.length > 200) {
    return Response.json({ error: "Too many numbers at once (max 200)" }, { status: 400 });
  }

  const results = await mapWithConcurrency(numbers, 4, async (e164) => {
    try {
      const r = await lookupOne(e164);
      return { phone: e164, ...r };
    } catch (e) {
      return { phone: e164, found: false, error: e.message };
    }
  });

  const foundCount = results.filter((r) => r.found).length;
  return Response.json({ count: numbers.length, found: foundCount, results });
}
