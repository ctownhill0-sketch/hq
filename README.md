# HQ Desk

A private, local-only sales and planning workspace for HQ. It runs on your laptop only (`127.0.0.1`), stores your data in one SQLite file, and has no accounts, analytics or hosting. It never contacts anyone for you.

**Stage 1 (current):** agency search (Google Places), saved agencies, agency page with live Google details, qualification, call log with the six discovery questions, tasks, demos, follow-ups, call script, manual "add by hand" agencies, and fake sample agencies.

---

## Setup

You need **Node.js 18.17 or newer** (`node -v`). Download it from nodejs.org if you don't have it.

```bash
cd hq
npm install
cp .env.example .env        # Windows: copy .env.example .env
npm run db:init             # creates data/hq-desk.db and adds 3 FAKE sample agencies
```

The app works without a Google key. Search stays off and explains how to turn it on. To enable it, follow **Google Cloud setup** below, then open `.env` in a text editor and paste the key after `GOOGLE_PLACES_API_KEY=`. Never paste the key into chat, the browser, or a commit.

## Run

```bash
npm start
```

Open **http://127.0.0.1:4317** (or the `PORT` you set). Stop it with `Ctrl+C`.

The server binds to `127.0.0.1` only, so other devices on your Wi-Fi cannot reach it.

## Test

```bash
npm test
```

The tests use an in-memory database and a fake Google endpoint. They never call Google or touch your real data. They cover:
- place-ID-only storage (they search, save and view details, then scan every table for Google values)
- field mask and API key handling
- stale place IDs and relinking
- rate limits
- the details cache cap
- running with no API key
- input validation
- CSRF, Origin and Host protections

## Backup

All your data is in one file: `data/hq-desk.db` (or your `DB_PATH`).

1. Stop the server (`Ctrl+C`). This folds any `-wal` file back into the main file.
2. Copy the file somewhere safe with the date in its name:
   ```bash
   mkdir -p backups && cp data/hq-desk.db backups/hq-desk-$(date +%F).db
   ```
3. To restore, stop the server and copy a backup back to `data/hq-desk.db`.

`backups/` and `*.db` are git-ignored. Keep backups off any public repo or shared drive.

You can also download your own notes, calls, tasks and demos as JSON from the sidebar link **Export my notes (JSON)**. Google agencies appear there by place ID only.

## Reset (start over)

This **deletes all your data**, so back up first.

```bash
# stop the server first
npm run db:reset -- --yes
```

This recreates an empty database with the fake sample agencies. To remove the samples, delete them from their agency pages.

---

## Google Cloud setup (key, quotas, budget)

Do these in the Google Cloud Console (console.cloud.google.com) with a project used only for HQ Desk.

### 1. Enable only Places API (New)
1. **APIs & Services → Library**. Search for **"Places API (New)"** and click **Enable**.
2. Do not enable the legacy "Places API" or other Maps APIs. This app doesn't use them.

### 2. Create and restrict the key
1. **APIs & Services → Credentials → Create credentials → API key**.
2. Click the key, then **Edit API key**:
   - **Name:** `hq-desk-local`
   - **API restrictions → Restrict key →** tick **Places API (New)** only. Save.
   - **Application restrictions:** a server key can't use "Websites". Choose **IP addresses** and add your home public IP if it's stable, or leave it as None. With None, the API restriction and quota caps below are your main protection.
3. Copy the key into `.env` only.
4. If the key ever leaks (pasted somewhere, committed), **delete it in Credentials** and create a new one.

### 3. Cap usage with quotas (this stops spending)
1. **APIs & Services → Enabled APIs → Places API (New) → Quotas & System Limits**.
2. Find the per-day and per-minute request quotas (e.g. "SearchTextRequest per day" and "GetPlaceRequest per day"). Click the pencil icon and set low values, e.g. **200/day** and **10/minute** for each, to match the app's own limits.
3. Requests over a quota are rejected by Google, which hard-stops spending on that API.

### 4. Budget alerts (these do NOT stop spending)
1. **Billing → Budgets & alerts → Create budget**.
2. Scope it to this project. Set a small monthly amount (e.g. $10) and alert thresholds at 50%, 90% and 100%.
3. **Important:** budget alerts only send emails. They do **not** stop charges. The quota caps in step 3 and the app's rate limits are what actually limit cost.

### Cost notes
- Billing depends on the fields requested. The app always sends a field mask with only: `id, displayName, formattedAddress, websiteUri, nationalPhoneNumber, googleMapsUri, businessStatus`.
- `websiteUri` and `nationalPhoneNumber` put requests in a higher-priced SKU tier. Check current prices at developers.google.com/maps/billing-and-pricing.
- Each search counts as 1 call. Opening a saved Google agency counts as 1 call. The sidebar shows today's count.

## Google Places rules this app follows

The full list, with policy links, is at the top of `src/google/places.js`. **Re-verify it against Google's current Places policy pages before relying on it.** Summary:

1. Every request sends a minimal field mask.
2. Only the **place ID** is stored. Names, addresses, phones and websites are fetched live when you open an agency and are never written to disk. The optional details cache is in memory only, capped under 5 minutes, and off by default.
3. There is no export of Google data. The JSON export contains only your own records, with place IDs.
4. "Google Maps" attribution (plus any attributions the API returns) is shown wherever Google data appears. No non-Google maps are used.
5. If a saved place ID stops working, the agency page shows **"Listing no longer available"** with a **Search again to relink** button. Your notes stay attached.

For agencies you **add by hand**, the name, website and phone are your own typed data. Don't copy them from Google Maps; use Find agencies for Google listings. For Google agencies, the optional **label** field is for your own short name, typed by you.

## Configuration (`.env`)

| Setting | Default | Meaning |
|---|---|---|
| `GOOGLE_PLACES_API_KEY` | (empty) | Server-side only. Never sent to the browser or logged. |
| `PORT` | 4317 | Local port. The host is always 127.0.0.1. |
| `GOOGLE_RATE_LIMIT_PER_MINUTE` | 10 | Google calls allowed per minute. |
| `GOOGLE_RATE_LIMIT_PER_DAY` | 200 | Google calls per local day. Stored in the DB, so restarts don't reset it. |
| `PLACE_DETAILS_CACHE_SECONDS` | 0 | In-memory details cache. Maximum 299. |
| `DB_PATH` | ./data/hq-desk.db | Location of your database. |

## Security notes
- Only binds to `127.0.0.1`. Requests whose `Host` isn't `127.0.0.1`/`localhost` are refused, which blocks DNS-rebinding attacks.
- Every write needs the `X-HQ-Desk` header and JSON body, and a cross-origin `Origin` is refused. This is the CSRF protection.
- A strict Content-Security-Policy allows no external scripts. All page text is inserted as text, never HTML. Links are allowed only if they are `http(s)`.
- All SQL is parameterized. Every API route rejects unknown fields and validates types, lengths, enums, dates and URLs.

## Project layout

```
server.js                 entry point (binds 127.0.0.1)
src/app.js                Express app factory
src/config.js             .env loading
src/security.js           host/CSRF checks, security headers
src/validate.js           input validation
src/db/                   SQLite open + migrations + fake sample seed
src/google/               Places client (policy rules), rate limit, cache
src/routes/               API routes
public/                   HTML/CSS/vanilla JS (no build step)
scripts/                  db:init, db:reset
test/                     node:test suites
```
