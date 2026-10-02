# HQ Desk

A private, local-only sales and planning workspace for HQ. It runs on your laptop only (`127.0.0.1`), stores your data in one SQLite file, and has no accounts, analytics or hosting. It never contacts anyone for you.

**Built so far:**
- **Stage 1:** agency search (Google Places), saved agencies, agency page with live Google details, qualification, call log with the six discovery questions, tasks, demos, follow-ups, call script, manual "add by hand" agencies, fake sample agencies.
- **Stage 1.5a (current):** the UI rebuilt in React + TypeScript + Tailwind (coss ui components, ReUI Kanban and Timeline): Today dashboard, agencies grid, agency page with tabs and timeline, Pipeline board, Follow-ups calendar, command palette, keyboard shortcuts, quick-log drawer, autosave, undo, light/dark themes.
- **Stage 1.5b (next):** the Deep Research screen. Its server side (crawler, AI analysis, caps) is already built and tested; the Research tab shows "coming in the next step" until the screen is added.

---

## Setup

You need **Node.js 20.19+ or 22.12+** (`node -v`); the UI build tool (Vite 8) requires it. Download it from nodejs.org if you don't have it.

```bash
cd hq
npm run setup               # installs the server packages, then the UI packages (scripts disabled)
cp .env.example .env        # Windows: copy .env.example .env
npm run db:init             # creates data/hq-desk.db and adds 3 FAKE sample agencies
npm run build               # compiles the UI into web/dist (re-run after pulling changes)
```

`npm run setup` is `npm install` (server) followed by `npm --prefix web ci` (UI, exact versions from `web/package-lock.json`). The UI folder has an `.npmrc` with `ignore-scripts=true`, so no UI package can run an install script. The server's `better-sqlite3` does need its install step (it fetches a prebuilt SQLite binary), so the root install keeps scripts on.

The app works without a Google key. Search stays off and explains how to turn it on. To enable it, follow **Google Cloud setup** below, then open `.env` in a text editor and paste the key after `GOOGLE_PLACES_API_KEY=`. Never paste the key into chat, the browser, or a commit.

## Run

```bash
npm start
```

Open **http://127.0.0.1:4317** (or the `PORT` you set). Stop it with `Ctrl+C`.

The server binds to `127.0.0.1` only, so other devices on your Wi-Fi cannot reach it. It serves the compiled UI from `web/dist`; if you see "UI is not built yet", run `npm run build`.

### Development (live reload)

```bash
npm run dev
```

This starts the API (Express on 127.0.0.1:4317, restarts on server changes) and the Vite dev server on **http://127.0.0.1:5173** (UI hot reload), which forwards `/api` to Express. Both bind to 127.0.0.1 only. Use 5173 while developing and 4317 for normal use.

## Test

```bash
npm test            # server: API, Google rules, security, research, contrast (node:test)
npm run test:web    # UI unit tests (Vitest + Testing Library)
npm run build && npm run test:e2e   # browser: axe accessibility scan, keyboard walkthrough, screenshots
```

`test:e2e` drives the compiled app in Chromium against a throwaway in-memory server with a **fake Google backend** (no real Google calls). It needs Chrome or Chromium on your machine; set `CHROMIUM_PATH` if it isn't found automatically. Light and dark screenshots of each page are written to `docs/screens/` (git-ignored, local only).

UI unit tests check: the CSRF token header is sent on every write (and refreshed once if the server restarted); no UI path sends Google-derived fields to the server (Save and Relink send only the place ID; edits next to the live Google card send only your typed fields); optimistic updates roll back when a request fails; moving to Declined requires a reason (cancelling sends nothing).

The server tests use an in-memory database, a fake Google endpoint, a fake agency website and a fake AI API. They never touch the network or your real data. They cover:
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

- **Today** (`g` `t`): overdue, today's and next-7-days follow-ups, upcoming demos, pipeline snapshot, agencies that still need research, Google usage.
- **Agencies** (`g` `a`): a grid with instant search (`/`), filters (stage, apartments yes/no/unknown, next follow-up), sortable columns, `↑`/`↓` (or `j`/`k`) to move, `Enter` to open, right-click (or the context-menu key) for Open / Log a call / Move to… / Delete.
- **Agency page:** stage selector (changing it shows an Undo toast; "Declined" asks for a reason), quick actions (Call, Email, Task, More), tabs (Overview, Research, Calls, Tasks, Notes) and an activity timeline. Fields **save automatically** as you type, with a "Saved" indicator.
- **Pipeline** (`g` `p`): Kanban board. Drag cards between stages, or use the keyboard: focus a card's grip handle, `Space` to pick up, arrow keys to move, `Space` to drop (`Esc` cancels). Every card also has a **Move to…** menu.
- **Follow-ups** (`g` `u`): the task list plus a month calendar of demos and dated tasks (arrow keys move between days, `PageUp`/`PageDown` change month).
- **Command palette:** `Cmd/Ctrl+K` to jump to any agency or run "Log a call", "Add task", "New agency", "Search Google".
- **Quick-log a call** from anywhere with `l`. Save with `Cmd/Ctrl+Enter`. A "next action" becomes a task.
- **Shortcuts:** press `?` for the full list. `[` collapses the sidebar. The theme button (bottom of the sidebar) cycles system / light / dark.
- **Deletes** (calls, tasks, demos, agencies) wait 5 seconds with an **Undo** button before anything is removed.
- **Motion:** frequent and keyboard actions (palette, quick log, tabs, sorting, theme) are instant; other transitions are short (≤200ms) and respect your system's "reduce motion" setting. Details in `DESIGN_SYSTEM_CHECKLIST.md`.

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

## Dependencies

Exact versions are pinned and both lockfiles are committed. No analytics or telemetry packages are included. `npm audit` (both folders): **0 vulnerabilities** at the time of writing.

**Server (`package.json`)**

| Package | Purpose |
|---|---|
| express | Local HTTP server and API |
| better-sqlite3 | SQLite database file |
| dotenv | Reads `.env` |
| @anthropic-ai/sdk | Deep Research AI call (server-side only; used from Stage 1.5b) |

**UI (`web/package.json`)**

| Package | Purpose |
|---|---|
| react, react-dom | UI library |
| @base-ui/react | Accessible primitives under the coss ui components |
| class-variance-authority, clsx, tailwind-merge | Component class composition (used by coss ui) |
| lucide-react | Icons, bundled locally |
| @fontsource-variable/inter | Inter variable font, self-hosted |
| @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities | Drag and drop for the Pipeline board (ReUI Kanban) |
| @tanstack/react-table | Agencies grid (sorting, rows) |
| vite, @vitejs/plugin-react | Build and dev server (dev only) |
| typescript, @types/react, @types/react-dom, @types/node | Type checking (dev only) |
| tailwindcss, @tailwindcss/vite | Styling (dev only; compiled to static CSS) |
| vitest, jsdom, @testing-library/react, @testing-library/user-event, @testing-library/jest-dom | UI unit tests (dev only) |
| axe-core | Accessibility checks in `test:e2e` (dev only) |
| playwright-core | Drives Chrome for `test:e2e`; downloads no browsers (dev only) |

**Copied-in component code (copy-and-own, not npm packages)**

- **coss ui** components in `web/src/components/ui/` and `web/src/lib/segmented-control.ts`, copied from [cosscom/coss](https://github.com/cosscom/coss) `apps/ui/registry/default` at commit `dd49ec9` (MIT; `apps/ui` is MIT per the repo's LICENSING.md). The documented install is `npx shadcn@latest add @coss/ui`, but coss.com (which hosts that registry) was not reachable from the build environment, so the documented manual method (copy the files) was used. Local edits: import paths; button press scale; ease-in-out → ease-out and durations ≤200ms; no backdrop blur; command palette and quick-log sheet made instant.
- **ReUI** Kanban and Timeline in `web/src/components/reui/`, added with the shadcn CLI from the free `@reui` registry (Base UI "base-nova" style, MIT). Local edits: `cn` import path, `import.meta.env.DEV` instead of `process.env`, drop animation 180ms ease-out (0 with reduced motion); a `handle` mode so cards can contain links/buttons without nested interactive controls; a column-aware keyboard coordinate getter (dnd-kit's default sent ArrowRight to the card below instead of the next column). ReUI's Data Grid, Filters and Event Calendar were **not** used: each is 300–400KB and pulls in shadcn components (dropdown-menu, checkbox, calendar) that clash with coss ui, so the grid uses `@tanstack/react-table`, filters use coss Select/Toggle Group/Input, and the calendar is a small own component.

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
- Only binds to `127.0.0.1` (the dev server too). Requests whose `Host` isn't `127.0.0.1`/`localhost` are refused, which blocks DNS-rebinding attacks.
- CSRF: the UI reads a random per-process token from `GET /api/session` and sends it as `X-CSRF-Token` on every write; writes also need a JSON body, and a cross-origin `Origin` is refused. Other websites can't read the token (no CORS is ever allowed).
- A strict Content-Security-Policy (`script-src 'self'`, `style-src 'self'`) allows no inline or external scripts; the compiled UI has none (the theme is set before paint by a static `theme-init.js` file). React escapes all text; links are rendered only for `http(s)` URLs. Base UI is wrapped in `CSPProvider disableStyleElements` so it never injects `<style>` tags (its one rule lives in `app.css`); the browser test fails on any CSP violation.
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
web/                      React + TypeScript + Tailwind UI (Vite); builds to web/dist
web/src/styles/tokens.css the one token set: colour (light/dark), stage colours, motion, z-index
web/src/components/ui/    coss ui components (copied, MIT)
web/src/components/reui/  ReUI Kanban + Timeline (copied via shadcn CLI, MIT)
web/src/components/app/   app components: sidebar, palette, quick log, stage badge, task list…
web/src/pages/            Today, Agencies, Agency (tabs), Pipeline, Follow-ups, Search, Add by hand
web/src/test/             UI unit tests
test/e2e/                 fake-Google server for browser checks; scripts/e2e.mjs runs them
DESIGN_SYSTEM_CHECKLIST.md design system checklist with status for every item
scripts/                  db:init, db:reset
test/                     node:test suites
```
