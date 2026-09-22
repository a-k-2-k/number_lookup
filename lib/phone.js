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
