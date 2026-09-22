// People Data Labs Person Enrichment (phone -> person).
import { linkedinSearchUrl } from "../phone.js";

export async function lookupPdl(e164) {
  const url = new URL("https://api.peopledatalabs.com/v5/person/enrich");
  url.searchParams.set("phone", e164);
  url.searchParams.set("min_likelihood", process.env.PDL_MIN_LIKELIHOOD || "5");
  url.searchParams.set("titlecase", "true");

  const r = await fetch(url, { headers: { "X-Api-Key": process.env.PDL_API_KEY }, cache: "no-store" });
  const body = await r.json().catch(() => ({}));

  if (r.status === 404) return { found: false };
  if (!r.ok) {
    const err = new Error(body?.error?.message || `PDL lookup failed (${r.status})`);
    err.status = r.status;
    throw err;
  }

  const d = body.data || {};
  const linkedin = d.linkedin_url
    ? d.linkedin_url.startsWith("http") ? d.linkedin_url : `https://${d.linkedin_url}`
    : null;

  return {
    found: true,
    source: "pdl",
    likelihood: body.likelihood,
    name: d.full_name || null,
    title: d.job_title || null,
    company: d.job_company_name || null,
    location: d.location_name || null,
    linkedin,
    linkedinSearch: linkedinSearchUrl(d.full_name, d.job_company_name),
  };
}
