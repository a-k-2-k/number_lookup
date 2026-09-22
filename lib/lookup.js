// Shared lookup logic used by both the single and bulk API routes.
// PDL gives the richest data (name + title + company + LinkedIn URL).
// Twilio Lookup and Trestle are name-only sources that fill gaps when PDL
// has no match. All configured providers run in parallel and are merged.
import { lookupPdl } from "./providers/pdl.js";
import { lookupTrestle } from "./providers/trestle.js";
import { lookupTwilio } from "./providers/twilio.js";
import { linkedinSearchUrl } from "./phone.js";

const hasTrestle = () => !!process.env.TRESTLE_API_KEY;
const hasPdl = () => !!process.env.PDL_API_KEY;
const hasTwilio = () => !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);

// Run one phone number through the configured providers and merge the result.
export async function lookupOne(e164) {
  let trestle = null;
  let pdl = null;
  let twilio = null;

  // Fire every configured provider in parallel; they're independent.
  const jobs = [];
  if (hasPdl()) jobs.push(lookupPdl(e164).then((r) => (pdl = r)).catch(() => {}));
  if (hasTwilio()) jobs.push(lookupTwilio(e164).then((r) => (twilio = r)).catch(() => {}));
  if (hasTrestle()) jobs.push(lookupTrestle(e164).then((r) => (trestle = r)).catch(() => {}));
  await Promise.all(jobs);

  const p = pdl?.found ? pdl : null;
  const w = twilio?.found ? twilio : null;
  const t = trestle?.found ? trestle : null;

  if (!p && !w && !t) return { found: false };

  // Prefer PDL's richer data; fall back to Twilio/Trestle name + location.
  const name = p?.name || w?.name || t?.name || null;
  const location = p?.location || t?.location || null;
  const company = p?.company || w?.company || null;
  const title = p?.title || null;
  const linkedin = p?.linkedin || null;

  const source =
    [p && "pdl", w && "twilio", t && "trestle"].filter(Boolean).join("+") || null;

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
  return { trestle: hasTrestle(), pdl: hasPdl(), twilio: hasTwilio() };
}
