# Number Lookup

Paste a bunch of phone numbers (a whole groupchat's worth), get each person's name and a LinkedIn link so you can see where they work.

## Setup
1. Get a People Data Labs API key: https://dashboard.peopledatalabs.com (this is the best single source: name + title + company + LinkedIn URL).
2. `cp .env.example .env.local` and paste your key into `PDL_API_KEY`.
3. (Optional) add **Twilio Lookup** for extra caller-name coverage: set `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` from https://console.twilio.com.
4. (Optional) add `TRESTLE_API_KEY` from https://portal.trestleiq.com/signup for more name coverage.
5. `npm install && npm run dev`, then open http://localhost:3000

## How it works
- **PDL** (richest) turns each number into name + job title + company + LinkedIn URL.
- **Twilio Lookup** and **Trestle** are name-only sources that fill in gaps when PDL has no match.
- All configured providers run in parallel and the best fields are merged.
- If there's no direct LinkedIn URL, you get a prefilled LinkedIn people-search link (name + company/city) so you can find their profile and company.

## Usage
- Paste numbers into the box, one per line or a full chat export. WhatsApp formatting (spaces, parens, hidden chars) is handled. 10-digit numbers are assumed US.
- Results build up into a saved contact table in your browser. Export to CSV anytime.
- Lookups run 4 at a time; max 200 numbers per paste.

## Deploy
Push to GitHub, import into Vercel, add `TRESTLE_API_KEY` (and optionally `PDL_API_KEY`) as env vars.
