'use strict';
// Runs one Deep Research job: robots.txt -> pages -> text -> LLM -> validate -> store.
// One run at a time, never queued, started only by you for one agency.
// Progress lives in memory (polled by the UI); results are stored in SQLite.
const { createSafeFetcher, FetchBlockedError } = require('./fetcher');
const { registeredDomain, sameSite, checkHostname, forbiddenSite } = require('./netguard');
const { htmlToText, extractTitle, extractLinks, selectPages, normalizeUrl } = require('./extract');
const { robotsPolicy, policyAllows } = require('./robots');
const { validateResult, SchemaError } = require('./schema');
const { priceFor, costOf, worstCaseCost } = require('./cost');
const { diffResults } = require('./diff');

class ResearchRefusedError extends Error {
  constructor(message, httpStatus = 429, code = 'RESEARCH_REFUSED') {
    super(message);
    this.httpStatus = httpStatus;
    this.code = code;
  }
}

const sleepDefault = (ms, signal) => new Promise((resolve, reject) => {
  if (!ms) return resolve();
  const t = setTimeout(resolve, ms);
  if (signal) signal.addEventListener('abort', () => { clearTimeout(t); reject(Object.assign(new Error('Cancelled.'), { code: 'CANCELLED' })); }, { once: true });
});

function createResearchRunner({ db, config, llm, resolve, transport, sleep = sleepDefault }) {
  const rc = config.research;
  const live = new Map(); // runId -> { progress, controller }
  let active = null;

  // Any run left "running" by a previous server process was interrupted.
  db.prepare("UPDATE research_runs SET status = 'failed', stage = 'failed', error = 'Interrupted (server restarted).', finished_at = datetime('now','localtime') WHERE status = 'running'").run();

  const todayStmt = db.prepare(`SELECT COUNT(*) AS runs,
      COALESCE(SUM(CASE WHEN status = 'running' THEN cost_estimate_usd ELSE COALESCE(cost_usd, 0) END), 0) AS spend
    FROM research_runs WHERE started_day = date('now','localtime')`);

  function usage() {
    const t = todayStmt.get();
    const enabled = llm.enabled && Boolean(rc.contactEmail) && Boolean(priceFor(config.llm));
    let reason = null;
    if (!llm.enabled) reason = llm.reason;
    else if (!rc.contactEmail) reason = 'Set RESEARCH_CONTACT_EMAIL in .env (used in the crawler User-Agent so site owners can reach you), then restart.';
    else if (!priceFor(config.llm)) reason = `No price known for model "${config.llm.model}". Set LLM_PRICE_INPUT_PER_MTOK and LLM_PRICE_OUTPUT_PER_MTOK in .env.`;
    return {
      enabled, reason,
      model: config.llm.model,
      runsToday: t.runs, runsPerDay: rc.runsPerDay,
      spendTodayUsd: Math.round(t.spend * 10000) / 10000, dailySpendCapUsd: rc.dailySpendCapUsd,
      maxCostPerRunUsd: worstCaseCost(config.llm, rc),
      maxPages: rc.maxPages, active: active ? active.runId : null,
    };
  }

  function checkConfirmedUrl(raw) {
    let u;
    try { u = new URL(String(raw).trim()); } catch { throw new ResearchRefusedError('Enter the full website address, starting with https://', 400, 'BAD_URL'); }
    if (u.protocol !== 'https:') throw new ResearchRefusedError('Only https:// websites can be researched.', 400, 'BAD_URL');
    const hostProblem = checkHostname(u.hostname);
    if (hostProblem) throw new ResearchRefusedError(`That address can't be researched: ${hostProblem}.`, 400, 'BAD_URL');
    if (forbiddenSite(u.hostname)) throw new ResearchRefusedError('Search engines, social networks, review and directory sites are never researched. Enter the agency\'s own website.', 400, 'BAD_URL');
    return normalizeUrl(u.toString());
  }

  function start(agencyId, rawUrl) {
    const u = usage();
    if (!u.enabled) throw new ResearchRefusedError(u.reason, 503, 'RESEARCH_DISABLED');
    if (active) throw new ResearchRefusedError('Another research run is in progress. Wait for it to finish or cancel it.', 409, 'BUSY');
    const confirmedUrl = checkConfirmedUrl(rawUrl);
    if (u.runsToday >= rc.runsPerDay) {
      throw new ResearchRefusedError(`Daily research limit reached (${rc.runsPerDay} runs). It resets at midnight, or raise RESEARCH_RUNS_PER_DAY in .env.`);
    }
    const estimate = u.maxCostPerRunUsd;
    if (u.spendTodayUsd + estimate > rc.dailySpendCapUsd) {
      throw new ResearchRefusedError(`Daily research spend cap would be exceeded: $${u.spendTodayUsd.toFixed(2)} used today + up to $${estimate.toFixed(2)} for this run > $${rc.dailySpendCapUsd.toFixed(2)} cap (RESEARCH_DAILY_SPEND_CAP_USD).`);
    }
    const runId = db.prepare(`INSERT INTO research_runs (agency_id, confirmed_url, status, stage, model, cost_estimate_usd)
      VALUES (?, ?, 'running', 'starting', ?, ?)`).run(agencyId, confirmedUrl, config.llm.model, estimate).lastInsertRowid;
    const controller = new AbortController();
    const progress = { stage: 'starting', message: 'Starting…', pagesDone: 0, pagesTotal: 1, pages: [] };
    live.set(runId, { progress, controller });
    active = { runId, controller };
    execute(runId, agencyId, confirmedUrl, controller.signal, progress)
      .catch(() => { /* errors are recorded inside execute */ })
      .finally(() => { active = null; setTimeout(() => live.delete(runId), 60_000).unref(); });
    return { id: runId, estimateUsd: estimate };
  }

  function cancel(runId) {
    const l = live.get(runId);
    if (!l || !active || active.runId !== runId) return false;
    l.controller.abort();
    return true;
  }

  function progressOf(runId) {
    const l = live.get(runId);
    return l ? l.progress : null;
  }

  async function execute(runId, agencyId, confirmedUrl, signal, progress) {
    const save = db.prepare(`UPDATE research_runs SET status=@status, stage=@stage, error=@error, pages_json=@pages_json,
      input_tokens=@input_tokens, output_tokens=@output_tokens, cost_usd=@cost_usd, result_json=@result_json,
      rejected_json=@rejected_json, diff_json=@diff_json, model=@model, finished_at=datetime('now','localtime') WHERE id=@id`);
    const record = { id: runId, status: 'failed', stage: 'failed', error: null, pages_json: null, input_tokens: null, output_tokens: null, cost_usd: 0, result_json: null, rejected_json: null, diff_json: null, model: config.llm.model };
    const set = (stage, message) => { progress.stage = stage; progress.message = message; db.prepare('UPDATE research_runs SET stage = ? WHERE id = ?').run(stage, runId); };
    let llmStarted = false;
    const pagesLog = [];

    try {
      const base = registeredDomain(new URL(confirmedUrl).hostname);
      const fetcher = createSafeFetcher({
        siteBase: base,
        userAgent: `HQDesk-research/1.0 (contact: ${rc.contactEmail})`,
        timeoutMs: rc.timeoutMs, maxBytes: rc.maxBytes, maxRedirects: rc.maxRedirects,
        ...(resolve ? { resolve } : {}), ...(transport ? { transport } : {}),
      });
      let lastRequest = 0;
      const politeFetch = async (url, kind) => { // 1 request per second
        const wait = lastRequest + rc.requestIntervalMs - Date.now();
        if (wait > 0) await sleep(wait, signal);
        lastRequest = Date.now();
        return fetcher.fetch(url, { kind, signal });
      };

      // 1. robots.txt
      set('robots', 'Checking robots.txt…');
      const origin = new URL(confirmedUrl).origin;
      let policy;
      try {
        const r = await politeFetch(`${origin}/robots.txt`, 'robots');
        policy = robotsPolicy({ status: r.status, body: r.body.toString('utf8').slice(0, 500_000) });
      } catch (e) {
        if (e.code === 'CANCELLED') throw e;
        if (e instanceof FetchBlockedError) throw e;
        policy = robotsPolicy({ error: e });
      }
      if (policy.disallowAll) throw Object.assign(new Error(`Not researched: ${policy.note}.`), { code: 'ROBOTS' });

      // 2. Homepage + selected pages
      const pages = [];
      const fetchPage = async (url) => {
        if (!policyAllows(policy, url)) { pagesLog.push({ url, status: null, chars: 0, note: 'blocked by robots.txt' }); return null; }
        try {
          const r = await politeFetch(url, 'html');
          if (r.status >= 400) { pagesLog.push({ url: r.finalUrl, status: r.status, chars: 0, note: `HTTP ${r.status}` }); return null; }
          if (!policyAllows(policy, r.finalUrl)) { pagesLog.push({ url: r.finalUrl, status: r.status, chars: 0, note: 'redirected to a path blocked by robots.txt' }); return null; }
          const html = r.body.toString('utf8');
          const text = htmlToText(html);
          const page = { url: normalizeUrl(r.finalUrl), title: extractTitle(html), text, links: extractLinks(html, r.finalUrl) };
          pagesLog.push({ url: page.url, status: r.status, chars: text.length, note: page.title ? page.title.slice(0, 120) : '' });
          return page;
        } catch (e) {
          if (e.code === 'CANCELLED' || (signal && signal.aborted)) throw Object.assign(new Error('Cancelled.'), { code: 'CANCELLED' });
          pagesLog.push({ url, status: null, chars: 0, note: e.message.slice(0, 160) });
          if (url === confirmedUrl && e instanceof FetchBlockedError) throw e;
          return null;
        }
      };

      progress.pagesTotal = rc.maxPages;
      set('fetching', `Fetching pages 1/${rc.maxPages}…`);
      const home = await fetchPage(confirmedUrl);
      progress.pagesDone = 1;
      progress.pages = pagesLog;
      if (!home) throw Object.assign(new Error(`Could not read the homepage: ${(pagesLog[pagesLog.length - 1] || {}).note || 'unknown error'}`), { code: 'HOMEPAGE' });
      pages.push(home);
      const candidates = selectPages(home.links, { sameSiteFn: (h) => sameSite(h, base), max: rc.maxPages - 1, exclude: new Set([home.url, confirmedUrl]) });
      progress.pagesTotal = 1 + candidates.length;
      for (const url of candidates) {
        set('fetching', `Fetching pages ${progress.pagesDone + 1}/${progress.pagesTotal}…`);
        const p = await fetchPage(url);
        progress.pagesDone++;
        if (p && !pages.some((x) => x.url === p.url)) pages.push(p);
      }

      // 3. Reading: trim text to the input token budget (about 3 characters per token, conservative).
      set('reading', 'Reading pages…');
      const usable = pages.filter((p) => p.text.length > 40);
      if (!usable.length) throw Object.assign(new Error('The site had no readable text (it may rely on JavaScript).'), { code: 'NO_TEXT' });
      let budget = rc.maxInputTokens * 3;
      const perPage = Math.floor(budget / usable.length);
      const docs = usable.map((p) => ({ url: p.url, text: p.text.slice(0, perPage) }));
      // Give unused budget to pages that were cut off.
      budget -= docs.reduce((n, d) => n + d.text.length, 0);
      for (const d of docs) {
        if (budget <= 0) break;
        const full = usable.find((p) => p.url === d.url).text;
        if (full.length > d.text.length) {
          const extra = Math.min(budget, full.length - d.text.length);
          d.text = full.slice(0, d.text.length + extra);
          budget -= extra;
        }
      }

      // 4. Analysing
      set('analysing', `Analysing ${docs.length} page${docs.length === 1 ? '' : 's'} with ${config.llm.model}…`);
      llmStarted = true;
      const out = await llm.analyze({ confirmedUrl, pages: docs, maxTokens: rc.maxOutputTokens, signal });
      const price = priceFor(config.llm);
      record.input_tokens = out.usage.input_tokens;
      record.output_tokens = out.usage.output_tokens;
      record.cost_usd = costOf(price, out.usage.input_tokens, out.usage.output_tokens);
      record.model = out.model;

      // 5. Validate (schema + verbatim quotes) and compare with the previous run.
      const { result, rejected } = validateResult(out.json, docs);
      const prev = db.prepare("SELECT result_json FROM research_runs WHERE agency_id = ? AND status = 'succeeded' AND id <> ? ORDER BY id DESC LIMIT 1").get(agencyId, runId);
      Object.assign(record, {
        status: 'succeeded', stage: 'done',
        result_json: JSON.stringify(result), rejected_json: JSON.stringify(rejected),
        diff_json: prev ? JSON.stringify(diffResults(JSON.parse(prev.result_json), result)) : null,
      });
      progress.stage = 'done';
      progress.message = 'Done';
    } catch (e) {
      const cancelled = e.code === 'CANCELLED' || (signal && signal.aborted);
      record.status = cancelled ? 'cancelled' : 'failed';
      record.stage = record.status;
      record.error = cancelled ? 'Cancelled by you.' : (e instanceof SchemaError ? `${e.message}. Result rejected for safety.` : e.message).slice(0, 500);
      if (e.usage) {
        record.input_tokens = e.usage.input_tokens;
        record.output_tokens = e.usage.output_tokens;
        record.cost_usd = costOf(priceFor(config.llm), e.usage.input_tokens, e.usage.output_tokens);
      } else if (llmStarted && record.cost_usd === 0 && (cancelled || e.billed)) {
        // Unknown actual cost after the LLM call began: count the worst case toward the daily cap.
        record.cost_usd = worstCaseCost(config.llm, rc);
      }
      progress.stage = record.status;
      progress.message = record.error;
    } finally {
      record.pages_json = JSON.stringify(pagesLog);
      progress.pages = pagesLog;
      save.run(record);
      db.prepare("INSERT INTO agency_events (agency_id, kind, detail) VALUES (?, 'research', ?)")
        .run(agencyId, record.status === 'succeeded' ? 'Research run completed' : `Research run ${record.status}`);
    }
  }

  return { start, cancel, progressOf, usage, isEnabled: () => usage().enabled };
}

module.exports = { createResearchRunner, ResearchRefusedError };
