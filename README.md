# HQ Desk

A private, local-only sales and planning workspace for HQ. It runs on your laptop only (`127.0.0.1`), stores your data in one SQLite file, and has no accounts, analytics or hosting. It never contacts anyone for you.

**Built so far:**
- **Stage 1:** agency search (Google Places), saved agencies, agency page with live Google details, qualification, call log with the six discovery questions, tasks, demos, follow-ups, call script, manual "add by hand" agencies, fake sample agencies.
- **Stage 1.5:** per-agency **Deep Research** (AI fit assessment from the agency's own website, with sources) and a full UI overhaul: Today dashboard, light/dark themes, command palette, keyboard shortcuts, quick-log drawer, autosave, undo.

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

The tests use an in-memory database, a fake Google endpoint, a fake agency website and a fake AI API. They never touch the network or your real data. They cover:
- research SSRF protections: http, localhost, IP literals, private/link-local/IPv6-mapped addresses, redirects to private IPs or other domains, too many redirects
- robots.txt parsing and obedience; robots.txt errors stop the run
- strict schema validation: off-schema, extra or injected fields reject the whole result; invented quotes are dropped
- daily run and spend caps; actual cost recorded; keys never stored or shown
- no Google-derived values in `research_runs`; Accept writes only whitelisted fields of your own
- WCAG AA contrast of the colour tokens in light and dark themes
- place-ID-only storage (they search, save and view details, then scan every table for Google values)
- field mask and API key handling
- stale place IDs and relinking
- rate limits
- the details cache cap
- running with no API key
- input validation
- CSRF, Origin and Host protections

## Using the app

- **Today** (`g` `t`): overdue and due follow-ups, demos, pipeline snapshot, agencies that still need research, daily limits.
- **Agencies** (`g` `a`): instant search (`/`), filters (stage, apartments, fit score, follow-up), click column headers to sort, `j`/`k` or arrows to move, `Enter` to open.
- **Agency page:** stage selector (changing it shows an Undo toast; "Declined" asks for a reason), quick actions (Call, Email, Task), tabs (Overview, Research, Calls, Tasks, Notes) and an activity timeline. Fields **save automatically** as you type, with a "Saved" indicator.
- **Command palette:** `Cmd/Ctrl+K` to jump to any agency or run "Log a call", "Add task", "New agency", "Search Google".
- **Quick-log a call** from anywhere with `l`. Save with `Cmd/Ctrl+Enter`. A "next action" becomes a task.
- **Shortcuts:** press `?` for the full list. `[` collapses the sidebar. The theme button (bottom of the sidebar) cycles system / light / dark.
- **Deletes** (calls, tasks, demos, agencies) wait 5 seconds with an **Undo** button before anything is removed.

## Deep Research (per agency, on demand)

Deep Research helps you decide quickly whether an agency is a qualified buyer for the $1,500 pilot: a licensed independent agency that regularly handles apartment/habitational insurance, has a visible renewal-document bottleneck, a decision maker and a reviewer.

**To turn it on**, add these to `.env` and restart:
```
LLM_API_KEY=your-anthropic-api-key      # from console.anthropic.com, read from .env only
RESEARCH_CONTACT_EMAIL=you@example.com  # shown in the crawler's User-Agent
```
Without them, the Research tab explains what's missing and everything else works.

**How a run works:**
1. Open an agency, go to **Research**, and **confirm the website URL**. It's prefilled from your last confirmed URL, the website you typed, or the live Google details on screen. The URL you confirm is what's used and stored, as your own data. One agency per run, one run at a time, never queued.
2. HQ Desk reads robots.txt, then fetches the homepage plus up to 7 linked pages on the same domain that look relevant (services, apartments/habitational, about, team, carriers, technology, contact, news). Login, cart and payment pages are skipped, as are PDFs and other non-HTML files.
3. The text (scripts, styles and navigation removed) goes to the AI model with strict rules: page text is untrusted data, any instructions inside it are ignored, the output must match a fixed JSON schema, and the model has no tools.
4. The result is validated again on the server. Anything off-schema is rejected. Any finding whose quote can't be found on the cited page is dropped and listed as "dropped by verification".
5. You see a fit score (0-100) with a rubric breakdown, findings with source links, call prep (5 tailored questions plus 2-3 personalisation lines, never sent anywhere), and what changed since the last run. Old runs are kept.
6. Each finding has **Accept into my notes** (copies it into your qualification fields or notes, tagged "[AI research …, verify]"), **Dismiss** and **Wrong**. Your decisions are stored. **Nothing is applied automatically.**

**Rules it follows (plain language):**
- Only https sites on public internet addresses. Local network, loopback and other private addresses are blocked, and this is re-checked after every redirect. Each connection is pinned to the address that was checked.
- It stays on the confirmed site's domain, follows at most 5 redirects, waits 10 seconds at most per page, reads at most 1.5 MB per page and 8 pages per run, and goes 1 request per second.
- It obeys robots.txt. If robots.txt can't be read because of a server error, it doesn't crawl at all.
- It never visits Google Search, social networks, review sites, directories or anything behind a login. It doesn't bulk-research or queue agencies.
- About people, it only records names and titles the business itself publishes.
- No Google data (names, addresses, phones, ratings, reviews) is sent to the model or stored with research.
- Keys and full page text are never logged.
- **AI findings can be wrong. Check the source before you rely on anything.**

**Licence check:** the **Verify licence** button opens the Pennsylvania Insurance Department lookup (set `PA_LICENCE_LOOKUP_URL` in `.env` to its current producer lookup page). Look the agency up yourself, then tick "I verified this agency's licence". The app doesn't automate the lookup.

### Research cost controls

| Setting | Default | Meaning |
|---|---|---|
| `LLM_MODEL` | claude-opus-5-5 | Model used. `claude-sonnet-5-5` costs about half as much; `claude-haiku-4-5` is cheaper still. |
| `LLM_EFFORT` | medium | low / medium / high. Higher means more thorough and more output tokens. |
| `RESEARCH_MAX_PAGES` | 8 | Pages per run (8 is the hard maximum). |
| `RESEARCH_MAX_INPUT_TOKENS` | 30000 | Page text is trimmed to fit this. |
| `RESEARCH_MAX_OUTPUT_TOKENS` | 16000 | Cap on the model's answer, including its reasoning. |
| `RESEARCH_RUNS_PER_DAY` | 10 | Runs started per local day. |
| `RESEARCH_DAILY_SPEND_CAP_USD` | 3.00 | A run is refused if today's spend plus this run's **worst case** would exceed the cap. |

- Before a run, the UI shows the worst-case cost (all input tokens plus the full output cap, at the model's price). With the defaults on claude-opus-5-5 ($4 / $20 per million tokens), that's about **$0.45**.
- After a run, it shows the actual cost from the token counts the API reports. Runs, spend and caps appear in the sidebar meters.
- If a run is cancelled or fails after the AI call has started and the real cost is unknown, the worst case counts toward the daily cap.
- Prices are in `src/research/cost.js`. Check them against Anthropic's pricing page, or override them with `LLM_PRICE_INPUT_PER_MTOK` / `LLM_PRICE_OUTPUT_PER_MTOK`.
- Also set a spend limit on your Anthropic account (Console → Billing → Limits). The app's caps protect you within the app; the account limit protects the key.
- `LLM_REFUSAL_FALLBACK=true` turns on Anthropic's server-side fallback: if the model declines, a fallback model may answer instead, and that's billed at the fallback model's price.

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
- Deep Research crawls only public https addresses: DNS is checked and the connection is pinned on every hop, robots.txt is obeyed, and output is checked against a strict schema. The AI key is only in `.env`, never sent to the browser, and redacted from errors.
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
src/research/             Deep Research: netguard (SSRF), fetcher, robots, extract,
                          schema (strict validation), llm, cost, runner, diff, accept
src/routes/               API routes
public/css/tokens.css     design tokens (colour, spacing, type, motion) for light + dark
public/js/ui/             toasts, dialogs, palette, shortcuts, quick-log drawer, autosave
public/js/views/          pages (Today, Agencies, Agency tabs, Search, Add by hand)
public/fonts/             self-hosted Inter variable font (OFL licence included)
scripts/                  db:init, db:reset
test/                     node:test suites
```
