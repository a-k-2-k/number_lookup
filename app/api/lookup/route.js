// Server-side only: keeps your API key out of the browser.
// Uses People Data Labs Person Enrichment (phone -> person).

function normalizePhone(raw) {
  // Handles WhatsApp formats like "+1 (510) 555-1234", "‪+1 510-555-1234‬", "5105551234"
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

export async function POST(req) {
  const key = process.env.PDL_API_KEY;
  if (!key) {
    return Response.json({ error: "Missing PDL_API_KEY in .env.local" }, { status: 500 });
  }

  const { phone } = await req.json().catch(() => ({}));
  const e164 = normalizePhone(phone);
  if (e164.replace(/\D/g, "").length < 8) {
    return Response.json({ error: "That doesn't look like a phone number" }, { status: 400 });
  }

  const url = new URL("https://api.peopledatalabs.com/v5/person/enrich");
  url.searchParams.set("phone", e164);
  url.searchParams.set("min_likelihood", process.env.PDL_MIN_LIKELIHOOD || "5");
  url.searchParams.set("titlecase", "true");

  const r = await fetch(url, { headers: { "X-Api-Key": key }, cache: "no-store" });
  const body = await r.json().catch(() => ({}));

  if (r.status === 404) {
    return Response.json({ phone: e164, found: false });
  }
  if (!r.ok) {
    return Response.json(
      { error: body?.error?.message || `Lookup failed (${r.status})` },
      { status: r.status }
    );
  }

  const d = body.data || {};
  const linkedin = d.linkedin_url
    ? d.linkedin_url.startsWith("http") ? d.linkedin_url : `https://${d.linkedin_url}`
    : null;

  return Response.json({
    phone: e164,
    found: true,
    likelihood: body.likelihood,
    name: d.full_name || null,
    title: d.job_title || null,
    company: d.job_company_name || null,
    location: d.location_name || null,
    linkedin,
    linkedinSearch: d.full_name
      ? `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
          [d.full_name, d.job_company_name].filter(Boolean).join(" ")
        )}`
      : null,
  });
}
