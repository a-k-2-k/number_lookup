// Server-side only: keeps API keys out of the browser.
// Single-number lookup. Trestle is primary; PDL enriches when configured.
import { normalizePhone } from "../../../lib/phone.js";
import { lookupOne, providersConfigured } from "../../../lib/lookup.js";

export async function POST(req) {
  const { trestle, pdl } = providersConfigured();
  if (!trestle && !pdl) {
    return Response.json(
      { error: "No provider configured. Add TRESTLE_API_KEY (and optionally PDL_API_KEY) to .env.local" },
      { status: 500 }
    );
  }

  const { phone } = await req.json().catch(() => ({}));
  const e164 = normalizePhone(phone);
  if (e164.replace(/\D/g, "").length < 8) {
    return Response.json({ error: "That doesn't look like a phone number" }, { status: 400 });
  }

  try {
    const result = await lookupOne(e164);
    return Response.json({ phone: e164, ...result });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}
