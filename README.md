# Number Lookup

Paste a bunch of phone numbers (a whole groupchat's worth), get each person's name and a LinkedIn link so you can see where they work.

## Setup
1. Get a Trestle Reverse Phone API key: https://portal.trestleiq.com/signup
2. `cp .env.example .env.local` and paste your key into `TRESTLE_API_KEY`
3. (Optional) add a `PDL_API_KEY` from https://dashboard.peopledatalabs.com to also pull job title, company, and a direct LinkedIn URL when available.
4. `npm install && npm run dev`, then open http://localhost:3000

## How it works
- **Trestle** (primary) turns each phone number into the registered owner's name + city/state.
- **PDL** (optional) enriches matches with job title, company, and a real LinkedIn URL.
- If there's no direct LinkedIn URL, you get a prefilled LinkedIn people-search link (name + company/city) so you can find their profile and company.

## Usage
- Paste numbers into the box, one per line or a full chat export. WhatsApp formatting (spaces, parens, hidden chars) is handled. 10-digit numbers are assumed US.
- Results build up into a saved contact table in your browser. Export to CSV anytime.
- Lookups run 4 at a time; max 200 numbers per paste.

## Deploy
Push to GitHub, import into Vercel, add `TRESTLE_API_KEY` (and optionally `PDL_API_KEY`) as env vars.
