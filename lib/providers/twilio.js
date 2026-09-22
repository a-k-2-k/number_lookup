// Twilio Lookup v2 (phone -> caller ID name / CNAM, US).
// Auth: HTTP Basic with Account SID + Auth Token.
// Returns the registered caller name; no title/company/LinkedIn, so we
// fall back to a LinkedIn search by name.
import { linkedinSearchUrl } from "../phone.js";

export async function lookupTwilio(e164) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;

  const url = new URL(`https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(e164)}`);
  // Request the caller-name data package.
  url.searchParams.set("Fields", "caller_name");

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const r = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });
  const body = await r.json().catch(() => ({}));

  // Twilio returns 404 for numbers it can't find at all.
  if (r.status === 404) return { found: false };
  if (!r.ok) {
    const err = new Error(body?.message || `Twilio lookup failed (${r.status})`);
    err.status = r.status;
    throw err;
  }

  const cn = body.caller_name || {};
  const name = cn.caller_name || null;
  // caller_type is "CONSUMER" or "BUSINESS"; a business name isn't a person.
  const isBusiness = cn.caller_type === "BUSINESS";
  if (!name) return { found: false };

  return {
    found: true,
    source: "twilio",
    likelihood: null,
    name,
    title: null,
    company: isBusiness ? name : null,
    location: null,
    linkedin: null,
    linkedinSearch: linkedinSearchUrl(name),
  };
}
