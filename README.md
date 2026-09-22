# Number Lookup

Paste a WhatsApp number, get the person's name, role, company, and LinkedIn.

## Setup
1. Get a People Data Labs API key: https://dashboard.peopledatalabs.com
2. `cp .env.example .env.local` and paste your key
3. `npm install && npm run dev`, then open http://localhost:3000

## Deploy
Push to GitHub, import into Vercel, add `PDL_API_KEY` as an env var.

## Notes
- Pasting into the box auto-runs the lookup. WhatsApp formatting (spaces, parens, hidden chars) is handled. 10-digit numbers are assumed US.
- No LinkedIn URL in the match? You get a prefilled LinkedIn search button instead.
- Recent lookups are saved in your browser, and you can export them to CSV.
- `PDL_MIN_LIKELIHOOD` (1-10) sets how strict matching is.
