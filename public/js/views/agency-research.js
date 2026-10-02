// Research tab: confirm URL -> run (with live progress + cancel) -> findings
// you Accept / Dismiss / mark Wrong. Nothing is applied automatically.
import { api } from '../api.js';
import { h, btn, field, extLink, hostOf, money, fmtDateTime, emptyState, copyText } from '../dom.js';
import { icon } from '../icons.js';
import { toast } from '../ui/toast.js';

const STEPS = [['robots', 'robots.txt'], ['fetching', 'Fetching pages'], ['reading', 'Reading'], ['analysing', 'Analysing'], ['done', 'Done']];
const SECTIONS = [
  ['leaders', 'Leaders (as published)', 'users', 'Decision maker fields'],
  ['pain_signals', 'Renewal / process pain signals', 'alert', '"Problem described"'],
  ['technology', 'Technology mentioned', 'monitor', '"Current system"'],
  ['markets_carriers_wholesalers', 'Markets, carriers, wholesalers', 'building', 'Notes'],
  ['niches_and_lines', 'Other niches and lines', 'pipeline', 'Notes'],
  ['team_size_signals', 'Team size signals', 'users', 'Notes'],
  ['red_flags', 'Red flags', 'flag', 'Notes'],
];
const VERDICT = { yes: ['Yes', 'badge-success'], likely: ['Likely', 'badge-info'], no: ['No', 'badge-danger'], not_found: ['Not found', ''] };

function emitUsage(u) { if (u) window.dispatchEvent(new CustomEvent('hq:research-usage', { detail: u })); }

export async function researchTab(ctx) {
  const root = h('div', { class: 'stack' });
  let state = await api(`/agencies/${ctx.id}/research`);
  emitUsage(state.usage);
  let viewing = state.latest;
  let decisions = new Map(state.decisions.map((d) => [d.finding_key, d.decision]));

  const intro = h('details', { class: 'card disclosure', open: !state.runs.length },
    h('summary', { class: 'card-pad' }, icon('shield'), 'What Deep Research will and will not do'),
    h('div', { class: 'card-body stack-sm small', vars: { 'padding-top': '0' } },
      h('p', {}, h('strong', {}, 'Will: '), 'read up to 8 public pages of the website you confirm (homepage plus services, apartments, about, team, carriers, contact and similar pages), obey robots.txt, go 1 request per second, and ask an AI model to summarise fit with a quote and source link for every finding.'),
      h('p', {}, h('strong', {}, 'Will not: '), 'search Google, visit social networks, review sites or anything behind a login, follow links to other domains, look up private individuals (only names and titles the business publishes), contact anyone, or change your records unless you click Accept.'),
      h('div', { class: 'callout callout-warn' }, icon('alert'), h('div', {}, h('strong', {}, 'AI findings can be wrong. '), 'Open the source link and check the quote before you rely on anything. Quotes that do not appear on the cited page are dropped automatically, but a real quote can still be misread.'))));

  const startCard = h('section', { class: 'card' });
  const progressCard = h('section', { class: 'card', hidden: true, 'aria-live': 'polite' });
  const results = h('div', { class: 'stack' });
  const history = h('section', { class: 'card' });
  root.append(intro, startCard, progressCard, results, history);

  // ---------- Start ----------
  function drawStart() {
    const u = state.usage;
    if (!u.enabled) {
      startCard.replaceChildren(h('div', { class: 'card-body' }, h('div', { class: 'callout callout-info' }, icon('alert'), h('div', { class: 'stack-sm' },
        h('strong', {}, 'Deep Research is off'),
        h('p', {}, u.reason),
        h('p', {}, 'Steps: open the .env file in the project folder, add LLM_API_KEY=… and RESEARCH_CONTACT_EMAIL=you@example.com, then restart the server. Never paste keys into chat or the browser. The rest of HQ Desk works without it.')))));
      return;
    }
    const suggested = state.suggested_url || ctx.liveWebsite || '';
    const source = state.suggested_url ? (state.runs.length ? 'your last confirmed URL' : 'the website you typed') : ctx.liveWebsite ? 'the live Google details on the Overview tab' : null;
    const url = h('input', { type: 'url', name: 'confirmed_url', value: suggested, placeholder: 'https://www.agency-website.com', required: true, 'aria-describedby': 'url-hint' });
    const confirm = h('input', { type: 'checkbox', required: true });
    const run = h('button', { type: 'submit', class: 'btn btn-primary', disabled: true }, icon('sparkles'), 'Research this agency');
    const sync = () => { run.disabled = !(confirm.checked && url.value.trim()) || Boolean(u.active); };
    confirm.addEventListener('change', sync);
    url.addEventListener('input', () => { confirm.checked = false; sync(); });
    const err = h('div', { role: 'alert' });
    const form = h('form', { class: 'card-body stack' },
      field('Agency website to research', url, null),
      h('p', { class: 'field-hint', id: 'url-hint' }, source ? `Prefilled from ${source}. Check it is the agency's own site. ` : 'Type the agency\'s own website. ', 'The URL you confirm is stored as your own data.'),
      h('label', { class: 'check' }, confirm, 'I confirm this is the agency\'s own website'),
      h('div', { class: 'row' },
        run,
        h('span', { class: 'small muted' }, 'Estimated cost: ', h('strong', { class: 'num' }, `at most ${money(u.maxCostPerRunUsd)}`), ` (${u.model}, up to ${u.maxPages} pages)`),
        h('span', { class: 'spacer' }),
        h('span', { class: 'xs subtle num' }, `Today: ${u.runsToday}/${u.runsPerDay} runs · ${money(u.spendTodayUsd)}/${money(u.dailySpendCapUsd)}`)),
      u.active && u.active !== (viewing && viewing.id) ? h('p', { class: 'small muted' }, 'Another research run is in progress. One run at a time.') : null,
      err);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.replaceChildren();
      run.disabled = true;
      try {
        const r = await api(`/agencies/${ctx.id}/research`, { method: 'POST', body: { confirmed_url: url.value.trim() } });
        emitUsage(r.usage);
        startPolling(r.id);
      } catch (x) {
        err.append(h('div', { class: 'callout callout-danger' }, icon('alert'), h('div', {}, x.message)));
        sync();
      }
    });
    startCard.replaceChildren(h('div', { class: 'card-head' }, h('h2', {}, icon('sparkles'), viewing ? 'Run research again' : 'Research this agency')), form);
  }

  // ---------- Progress (polling) ----------
  let polling = null;
  function startPolling(runId) {
    startCard.hidden = true;
    progressCard.hidden = false;
    if (!viewing || viewing.status !== 'succeeded') results.replaceChildren();
    const tick = async () => {
      if (!ctx.params.isCurrent()) return; // left this agency page
      try {
        const { run, usage } = await api(`/research/runs/${runId}`);
        emitUsage(usage);
        drawProgress(run);
        if (run.status === 'running') { polling = setTimeout(tick, 700); return; }
        polling = null;
        state = await api(`/agencies/${ctx.id}/research`);
        decisions = new Map(state.decisions.map((d) => [d.finding_key, d.decision]));
        viewing = run.status === 'succeeded' ? run : state.latest;
        progressCard.hidden = run.status === 'succeeded';
        startCard.hidden = false;
        drawStart(); drawResults(); drawHistory();
        ctx.refreshTimeline();
        if (run.status === 'succeeded') toast(`Research done · actual cost ${money(run.cost_usd, 3)}`);
        else if (run.status === 'cancelled') toast('Research cancelled');
      } catch (e) {
        progressCard.replaceChildren(h('div', { class: 'card-body' }, h('div', { class: 'callout callout-danger' }, icon('alert'), h('div', {}, `Lost track of the run: ${e.message}`))));
        startCard.hidden = false;
      }
    };
    tick();
  }

  function drawProgress(run) {
    const p = run.progress || { stage: run.stage, message: run.error || run.stage, pagesDone: 0, pagesTotal: 1, pages: run.pages };
    const idx = STEPS.findIndex(([k]) => k === p.stage);
    const failed = ['failed', 'cancelled'].includes(run.status);
    const pct = p.stage === 'fetching' ? Math.round((p.pagesDone / Math.max(p.pagesTotal, 1)) * 100) : idx >= 2 ? 100 : 5;
    const bar = h('div', { class: `progress ${p.stage === 'analysing' ? 'indeterminate' : ''}`, role: 'progressbar', 'aria-label': 'Research progress', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct },
      h('div', { class: 'progress-fill', vars: { '--w': `${pct}%` } }));
    const cancel = btn('Cancel', { size: 'sm', iconName: 'stop', onClick: async () => {
      cancel.disabled = true;
      try { await api(`/research/runs/${run.id}/cancel`, { method: 'POST', body: {} }); } catch (e) { toast(e.message, { kind: 'error' }); cancel.disabled = false; }
    } });
    progressCard.replaceChildren(
      h('div', { class: 'card-head' }, h('h2', {}, icon('sparkles'), failed ? `Research ${run.status}` : 'Researching…'), run.status === 'running' ? cancel : btn('Dismiss', { size: 'sm', kind: 'ghost', onClick: () => { progressCard.hidden = true; } })),
      h('div', { class: 'card-body stack' },
        h('ol', { class: 'steps' }, STEPS.map(([k, label], i) => h('li', { class: failed ? '' : i < idx || p.stage === 'done' ? 'done' : i === idx ? 'current' : '' }, i < idx && !failed ? icon('check', { size: 12 }) : null, label))),
        failed ? h('div', { class: 'callout callout-danger' }, icon('alert'), h('div', {}, run.error || 'The run did not finish.')) : bar,
        h('p', { class: 'small muted' }, failed ? `Pages tried: ${(run.pages || []).length}. ${run.cost_usd ? `Cost counted: ${money(run.cost_usd, 3)}.` : 'No AI cost.'}` : p.message),
        pageList(p.pages || run.pages || [])));
  }

  // ---------- Results ----------
  function drawResults() {
    results.replaceChildren();
    if (!viewing || viewing.status !== 'succeeded' || !viewing.result) {
      if (!state.runs.length && state.usage.enabled) results.append(h('div', { class: 'card' }, emptyState({ iconName: 'sparkles', title: 'No research yet', text: 'Confirm the agency\'s website above to get a fit score with sources in about a minute.' })));
      return;
    }
    const r = viewing.result;
    const isLatest = state.latest && viewing.id === state.latest.id;
    results.append(summaryCard(viewing, r));
    if (viewing.diff && !viewing.diff.unchanged) results.append(diffCard(viewing.diff));
    results.append(apartmentsCard(r.apartments, isLatest));
    for (const [key, title, ic, target] of SECTIONS) results.append(findingsCard(key, title, ic, target, r[key] || [], isLatest));
    results.append(callPrepCard(r));
    if (viewing.rejected && viewing.rejected.length) {
      results.append(h('details', { class: 'card disclosure' },
        h('summary', { class: 'card-pad' }, icon('eyeOff'), `${viewing.rejected.length} finding${viewing.rejected.length === 1 ? '' : 's'} dropped by verification`),
        h('div', { class: 'card-body stack-sm small', vars: { 'padding-top': '0' } },
          h('p', { class: 'muted' }, 'These were removed because the quote was not on the cited page, was too long, or cited a page that was not fetched. Shown for transparency only.'),
          viewing.rejected.map((x) => h('div', {}, h('strong', {}, x.label || x.name || x.where), ` · ${x.reasons.join(', ')}`)))));
    }
  }

  function summaryCard(run, r) {
    const score = r.fit.score;
    const C = 2 * Math.PI * 56;
    const ring = h('div', { class: `ring ${r.fit.low_confidence ? 'low' : ''}`, role: 'img', 'aria-label': `Fit score ${score} out of 100${r.fit.low_confidence ? ', low confidence' : ''}` });
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', '132'); svg.setAttribute('height', '132'); svg.setAttribute('viewBox', '0 0 132 132');
    for (const cls of ['ring-track', 'ring-value']) {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', '66'); c.setAttribute('cy', '66'); c.setAttribute('r', '56'); c.setAttribute('fill', 'none'); c.setAttribute('stroke-width', '10');
      c.setAttribute('class', cls);
      if (cls === 'ring-value') {
        c.setAttribute('stroke-linecap', 'round');
        c.setAttribute('stroke-dasharray', String(C));
        c.setAttribute('stroke-dashoffset', String(C));
        requestAnimationFrame(() => requestAnimationFrame(() => c.setAttribute('stroke-dashoffset', String(C * (1 - score / 100)))));
      }
      svg.append(c);
    }
    ring.append(svg, h('div', { class: 'ring-label' }, h('div', {}, h('div', { class: 'ring-num' }, String(score)), h('div', { class: 'ring-sub' }, 'fit / 100'))));
    const [vLabel, vCls] = VERDICT[r.apartments.verdict];
    return h('section', { class: 'card' },
      h('div', { class: 'card-head' },
        h('h2', {}, icon('sparkles'), 'Fit summary'),
        h('div', { class: 'row' },
          r.fit.low_confidence ? h('span', { class: 'badge badge-warning' }, icon('alert', { size: 12 }), 'Low confidence') : h('span', { class: 'badge badge-success' }, 'Evidence-backed'),
          h('span', { class: 'xs subtle' }, fmtDateTime(run.started_at)))),
      h('div', { class: 'card-body score-card' },
        ring,
        h('div', { class: 'stack' },
          h('div', { class: 'row' }, h('span', { class: 'small muted' }, 'Handles apartments:'), h('span', { class: `badge ${vCls}` }, vLabel)),
          h('p', {}, r.fit.why),
          h('div', { class: 'rubric' }, Object.entries(r.fit.rubric).map(([, x]) => h('div', { class: 'rubric-row' },
            h('span', {}, x.label), h('span', { class: 'num muted' }, `${x.score} / ${x.max}`),
            h('span', { class: 'bar' }, h('i', { vars: { '--w': `${Math.round((x.score / x.max) * 100)}%` } })),
            h('span', { class: 'reason' }, x.reason)))))),
      h('div', { class: 'card-foot xs subtle row' },
        h('span', { class: 'num' }, `${run.model} · ${run.input_tokens?.toLocaleString() || 0} in / ${run.output_tokens?.toLocaleString() || 0} out tokens`),
        h('span', { class: 'spacer' }),
        h('span', { class: 'num' }, `Cost ${money(run.cost_usd, 3)} (estimate was at most ${money(run.cost_estimate_usd)})`),
        h('span', {}, ' · '), extLink(run.confirmed_url, hostOf(run.confirmed_url))));
  }

  function diffCard(diff) {
    return h('section', { class: 'card card-pad' },
      h('h3', { class: 'row' }, icon('refresh'), 'What changed since the previous run'),
      h('ul', { class: 'diff-list', vars: { 'margin-top': '8px' } }, diff.changes.map((c) => h('li', {},
        c.text ? c.text : [h('strong', {}, `${c.label}: `),
          c.added.map((x, i) => [i ? ', ' : '', h('span', { class: 'added' }, `+ ${x}`)]),
          c.added.length && c.removed.length ? '; ' : '',
          c.removed.map((x, i) => [i ? ', ' : '', h('span', { class: 'removed' }, x)])]))));
  }

  // Accept / Dismiss / Wrong. Accept copies into YOUR fields; server decides which.
  function actions(key, target, enabled, card) {
    const current = decisions.get(key);
    const wrap = h('div', { class: 'finding-actions' });
    const draw = () => {
      const d = decisions.get(key);
      card.classList.toggle('is-accepted', d === 'accepted');
      card.classList.toggle('is-dismissed', d === 'dismissed');
      card.classList.toggle('is-wrong', d === 'wrong');
      if (!enabled) { wrap.replaceChildren(h('span', { class: 'decision-note' }, d ? `You marked this ${d}.` : 'Older run: view only.')); return; }
      if (d) {
        wrap.replaceChildren(h('span', { class: 'decision-note' }, d === 'accepted' ? `Accepted into ${target}` : d === 'dismissed' ? 'Dismissed' : 'Marked wrong'),
          btn('Undo', { size: 'sm', kind: 'ghost', iconName: 'undo', onClick: () => decide('undecided') }));
        return;
      }
      wrap.replaceChildren(
        btn('Accept into my notes', { size: 'sm', iconName: 'check', onClick: () => decide('accepted'), attrs: { 'data-tip': `Copies into ${target}` } }),
        btn('Dismiss', { size: 'sm', kind: 'ghost', onClick: () => decide('dismissed') }),
        btn('Wrong', { size: 'sm', kind: 'ghost', iconName: 'thumbDown', onClick: () => decide('wrong') }));
    };
    async function decide(decision) {
      const prev = decisions.get(key);
      if (decision === 'undecided') decisions.delete(key); else decisions.set(key, decision);
      draw(); // optimistic
      try {
        const res = await api(`/research/runs/${viewing.id}/decisions`, { method: 'POST', body: { finding_key: key, decision } });
        if (decision === 'accepted') {
          const fresh = await api(`/agencies/${ctx.id}`);
          Object.assign(ctx.agency, fresh.agency);
          ctx.invalidate('overview');
          ctx.invalidate('notes');
          toast(res.applied_fields.length ? `Copied into ${res.applied_fields.map((f) => f.replace(/_/g, ' ')).join(', ')}` : 'Accepted');
          ctx.refreshTimeline();
        }
        if (decision === 'undecided' && prev === 'accepted') toast('Decision cleared. Text already copied into your notes stays there; edit it on the Overview tab.');
      } catch (e) {
        if (prev) decisions.set(key, prev); else decisions.delete(key);
        draw();
        toast(e.message, { kind: 'error' });
      }
    }
    void current;
    draw();
    return wrap;
  }

  function sourceChip(url) {
    let path = url;
    try { const u = new URL(url); path = u.pathname === '/' ? hostOf(url) : u.pathname; } catch { /* keep */ }
    return extLink(url, path, 'source-chip');
  }

  function apartmentsCard(ap, enabled) {
    const card = h('section', { class: 'card' });
    const [vLabel, vCls] = VERDICT[ap.verdict];
    card.append(
      h('div', { class: 'card-head' }, h('h2', {}, icon('building'), 'Apartment / habitational evidence'), h('span', { class: `badge ${vCls}` }, vLabel)),
      h('div', { class: 'finding' },
        h('p', {}, ap.explanation),
        ap.evidence.length ? ap.evidence.map((e) => h('div', { class: 'stack-sm' }, h('blockquote', { class: 'quote' }, `“${e.quote}”`), h('div', {}, sourceChip(e.source_url))))
          : h('p', { class: 'small muted' }, 'Not found on the pages read. Ask on the call.'),
        actions('apartments', '"Handles apartments" and evidence', enabled, card)));
    return card;
  }

  function findingsCard(key, title, ic, target, items, enabled) {
    const card = h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', {}, icon(ic), title), h('span', { class: 'badge num' }, String(items.length))));
    if (!items.length) { card.append(h('p', { class: 'card-body small muted' }, 'Not found on the pages read.')); return card; }
    items.forEach((it, i) => {
      const row = h('div', { class: 'finding' },
        h('div', { class: 'finding-label' }, key === 'leaders' ? `${it.name} · ${it.title}` : it.label),
        h('blockquote', { class: 'quote' }, `“${it.quote}”`),
        h('div', { class: 'row' }, sourceChip(it.source_url)));
      row.append(actions(`${key}.${i}`, target, enabled, row));
      card.append(row);
    });
    return card;
  }

  function callPrepCard(r) {
    const copyAll = (list) => copyText(list.map((x, i) => `${i + 1}. ${x}`).join('\n'));
    return h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, icon('message'), 'Call prep'), h('span', { class: 'xs subtle' }, 'Drafts for you. Nothing is sent.')),
      h('div', { class: 'card-body stack' },
        h('div', { class: 'row' }, h('h3', {}, 'Tailored discovery questions'), h('span', { class: 'spacer' }), btn('Copy all', { size: 'sm', iconName: 'copy', onClick: () => copyAll(r.discovery_questions) })),
        h('ol', { class: 'questions' }, r.discovery_questions.map((q) => h('li', {}, q))),
        h('div', { class: 'row' }, h('h3', {}, 'Personalisation lines for your outreach')),
        h('ul', { class: 'copy-list' }, r.personalization_lines.map((l) => h('li', {}, h('span', {}, l), btn('', { size: 'sm', kind: 'ghost', iconName: 'copy', title: 'Copy line', onClick: () => copyText(l) })))),
        r.unknowns.length ? [h('h3', {}, 'Unknowns the call should answer'), h('ul', { class: 'questions' }, r.unknowns.map((u) => h('li', {}, u)))] : null));
  }

  function pageList(pages) {
    if (!pages || !pages.length) return h('span');
    return h('details', { class: 'disclosure small' }, h('summary', {}, `Pages (${pages.length})`),
      h('ul', { class: 'page-list', vars: { 'margin-top': '8px' } }, pages.map((p) => h('li', {},
        h('span', { class: `badge ${p.chars ? 'badge-success' : ''}` }, p.chars ? 'read' : 'skipped'),
        h('span', { class: 'url' }, extLink(p.url, p.url.replace(/^https:\/\//, ''))),
        p.note ? h('span', { class: 'subtle' }, `· ${p.note}`) : null))));
  }

  // ---------- History ----------
  function drawHistory() {
    if (!state.runs.length) { history.hidden = true; return; }
    history.hidden = false;
    history.replaceChildren(
      h('div', { class: 'card-head' }, h('h2', {}, icon('clock'), 'Run history'), h('span', { class: 'xs subtle' }, 'Old runs are kept')),
      h('div', { class: 'table-wrap', vars: { border: '0', 'box-shadow': 'none', 'border-radius': '0' } },
        h('table', { class: 'table' },
          h('thead', {}, h('tr', {}, ['Started', 'Status', 'Fit', 'Cost', 'Site', ''].map((t) => h('th', { scope: 'col' }, t)))),
          h('tbody', {}, state.runs.map((r) => h('tr', { class: viewing && viewing.id === r.id ? 'kb-active' : '' },
            h('td', { class: 'num' }, fmtDateTime(r.started_at)),
            h('td', {}, h('span', { class: `badge ${r.status === 'succeeded' ? 'badge-success' : r.status === 'running' ? 'badge-info' : r.status === 'failed' ? 'badge-danger' : ''}` }, r.status)),
            h('td', { class: 'num' }, r.fit_score ?? '-'),
            h('td', { class: 'num' }, money(r.cost_usd, 3)),
            h('td', { class: 'small' }, hostOf(r.confirmed_url)),
            h('td', {}, r.status === 'succeeded'
              ? btn(viewing && viewing.id === r.id ? 'Viewing' : 'View', { size: 'sm', kind: 'ghost', onClick: () => viewRun(r.id) })
              : r.status === 'running' ? btn('Progress', { size: 'sm', kind: 'ghost', onClick: () => startPolling(r.id) }) : h('span', { class: 'xs subtle' }, r.error ? r.error.slice(0, 60) : ''))))))));
  }

  async function viewRun(id) {
    try {
      const { run, decisions: ds } = await api(`/research/runs/${id}`);
      viewing = run;
      decisions = new Map(ds.map((d) => [d.finding_key, d.decision]));
      drawResults(); drawHistory();
      results.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    } catch (e) { toast(e.message, { kind: 'error' }); }
  }

  drawStart();
  drawResults();
  drawHistory();
  // Resume a run that is in progress (e.g. after navigating away and back).
  const running = state.runs.find((r) => r.status === 'running');
  if (running) startPolling(running.id);
  void polling;
  return root;
}
