// Shared lookup logic used by both the single and bulk API routes.
// Trestle is the primary source (reverse phone -> owner name + location).
// PDL is optional enrichment: if configured, it can add job title, company,
// and a real LinkedIn URL on top of (or instead of) the Trestle name.
import { lookupPdl } from "./providers/pdl.js";
import { lookupTrestle } from "./providers/trestle.js";
import { linkedinSearchUrl } from "./phone.js";

const hasTrestle = () => !!process.env.TRESTLE_API_KEY;
const hasPdl = () => !!process.env.PDL_API_KEY;

// Run one phone number through the configured providers and merge the result.
export async function lookupOne(e164) {
  let trestle = null;
  let pdl = null;

  // Fire both in parallel when both are configured; they're independent.
  const jobs = [];
  if (hasTrestle()) jobs.push(lookupTrestle(e164).then((r) => (trestle = r)).catch(() => {}));
  if (hasPdl()) jobs.push(lookupPdl(e164).then((r) => (pdl = r)).catch(() => {}));
  await Promise.all(jobs);

  const t = trestle?.found ? trestle : null;
  const p = pdl?.found ? pdl : null;

  if (!t && !p) return { found: false };

  // Prefer PDL's richer data (title/company/LinkedIn) when present,
  // but fall back to Trestle's name/location otherwise.
  const name = p?.name || t?.name || null;
  const location = p?.location || t?.location || null;
  const company = p?.company || null;
  const title = p?.title || null;
  const linkedin = p?.linkedin || null;

  const source = [t && "trestle", p && "pdl"].filter(Boolean).join("+") || null;

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
  return { trestle: hasTrestle(), pdl: hasPdl() };
}
