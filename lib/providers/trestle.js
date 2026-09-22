// Trestle Reverse Phone API (phone -> registered owner name + location).
// No job title, company, or LinkedIn URL: we fall back to a LinkedIn search by name + city.
import { linkedinSearchUrl } from "../phone.js";

export async function lookupTrestle(e164) {
  const url = new URL("https://api.trestleiq.com/3.2/phone");
  url.searchParams.set("phone", e164);

  const r = await fetch(url, { headers: { "x-api-key": process.env.TRESTLE_API_KEY }, cache: "no-store" });
  const body = await r.json().catch(() => ({}));

  if (!r.ok) {
    const err = new Error(body?.error?.message || body?.message || `Trestle lookup failed (${r.status})`);
    err.status = r.status;
    throw err;
  }

  const owner = (body.owners || []).find((o) => o?.name);
  if (!owner) return { found: false };

  const addr = owner.current_addresses?.[0];
  const location = [addr?.city, addr?.state_code].filter(Boolean).join(", ") || null;

  return {
    found: true,
    source: "trestle",
    likelihood: null,
    name: owner.name,
    title: null,
    company: null,
    location,
    linkedin: null,
    linkedinSearch: linkedinSearchUrl(owner.name, addr?.city),
  };
}
