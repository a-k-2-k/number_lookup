// Shared lookup logic used by both the single and bulk API routes.
// PDL gives the richest data (name + title + company + LinkedIn URL).
// Trestle is a name-only source that fills gaps when PDL has no match.
// All configured providers run in parallel and are merged.
import { lookupPdl } from "./providers/pdl.js";
import { lookupTrestle } from "./providers/trestle.js";
import { linkedinSearchUrl } from "./phone.js";

const hasTrestle = () => !!process.env.TRESTLE_API_KEY;
const hasPdl = () => !!process.env.PDL_API_KEY;

// Run one phone number through the configured providers and merge the result.
export async function lookupOne(e164) {
  let pdl = null;
  let trestle = null;

  // Fire every configured provider in parallel; they're independent.
  const jobs = [];
  if (hasPdl()) jobs.push(lookupPdl(e164).then((r) => (pdl = r)).catch(() => {}));
  if (hasTrestle()) jobs.push(lookupTrestle(e164).then((r) => (trestle = r)).catch(() => {}));
  await Promise.all(jobs);

  const p = pdl?.found ? pdl : null;
  const t = trestle?.found ? trestle : null;

  if (!p && !t) return { found: false };

  // Prefer PDL's richer data; fall back to Trestle name + location.
  const name = p?.name || t?.name || null;
  const location = p?.location || t?.location || null;
  const company = p?.company || null;
  const title = p?.title || null;
  const linkedin = p?.linkedin || null;

  const source = [p && "pdl", t && "trestle"].filter(Boolean).join("+") || null;

  return {
    found: true,
    source,
    likelihood: p?.likelihood ?? null,
    name,
    title,
    company,
    location,
    linkedin,
    // Always give a search link so you can find their company on LinkedIn.
    linkedinSearch:
      linkedinSearchUrl(name, company) ||
      linkedinSearchUrl(name, location?.split(",")[0]) ||
      linkedinSearchUrl(name),
  };
}

export function providersConfigured() {
  return { pdl: hasPdl(), trestle: hasTrestle() };
}
