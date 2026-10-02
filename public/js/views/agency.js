// Agency page: header (stage + quick actions), tabs, and an activity timeline.
import { api } from '../api.js';
import { h, btn, agencyName, LABELS, STAGE_ORDER, fmtDateTime, errorBox } from '../dom.js';
import { icon } from '../icons.js';
import { toast, withUndo } from '../ui/toast.js';
import { promptDialog, openDialog } from '../ui/dialog.js';
import { openQuickLog } from '../ui/quicklog.js';
import { notifyChange, pendingDeletes } from '../store.js';
import { listenWhileCurrent } from './util.js';
import { overviewTab, notesTab } from './agency-overview.js';
import { callsTab, tasksTab } from './agency-activity.js';
import { researchTab } from './agency-research.js';

const TABS = [['overview', 'Overview', 'building'], ['research', 'Research', 'sparkles'], ['calls', 'Calls', 'phone'], ['tasks', 'Tasks', 'task'], ['notes', 'Notes', 'notes']];

export async function render(root, params) {
  const id = Number(params.match[1]);
  const [data, rs] = await Promise.all([api(`/agencies/${id}`), api('/research/status')]);
  const a = data.agency;
  const ctx = { id, agency: a, data, params, licenceLookupUrl: rs.licenceLookupUrl, researchUsage: rs.research, refreshTimeline: () => {}, setTitle: () => {} };
  let tab = TABS.some(([t]) => t === params.query.get('tab')) ? params.query.get('tab') : 'overview';

  // ---------- Header ----------
  const titleEl = h('h1', {}, agencyName(a));
  const titleAttr = h('span');
  ctx.setTitle = (name, attributionNode) => { // Google name shown with its attribution
    if (a.label || a.source !== 'google') return;
    titleEl.textContent = name;
    titleAttr.replaceChildren(attributionNode);
  };
  const stageSel = h('select', { class: `stage-select stage-${a.pipeline_stage}`, 'aria-label': 'Pipeline stage' },
    STAGE_ORDER.map((s) => h('option', { value: s }, LABELS.stage[s])));
  stageSel.value = a.pipeline_stage;
  stageSel.addEventListener('change', () => changeStage(stageSel.value));

  async function changeStage(next, { undo = false } = {}) {
    const prev = a.pipeline_stage;
    const body = { pipeline_stage: next };
    if (next === 'declined' && !a.decline_reason) {
      const reason = await promptDialog({ title: 'Why did they decline?', label: 'Decline reason (required)', placeholder: 'e.g. Already uses a renewal tool; no budget this year' });
      if (!reason) { stageSel.value = prev; return; }
      body.decline_reason = reason;
    }
    // Optimistic update with rollback.
    a.pipeline_stage = next;
    stageSel.value = next;
    stageSel.className = `stage-select stage-${next}`;
    try {
      await api(`/agencies/${id}`, { method: 'PATCH', body });
      if (body.decline_reason) a.decline_reason = body.decline_reason;
      notifyChange({ agencyId: id, kind: 'stage', silent: true });
      ctx.refreshTimeline();
      if (!undo) toast(`Stage: ${LABELS.stage[next]}`, { action: { label: 'Undo', icon: 'undo', onClick: () => changeStage(prev, { undo: true }) } });
    } catch (e) {
      a.pipeline_stage = prev;
      stageSel.value = prev;
      stageSel.className = `stage-select stage-${prev}`;
      toast(`Stage not changed: ${e.message}`, { kind: 'error' });
    }
  }

  const meta = h('div', { class: 'agency-meta' },
    a.source === 'sample' ? h('span', { class: 'badge badge-sample' }, 'Fake sample') : null,
    a.source === 'manual' ? h('span', { class: 'badge' }, 'Added by hand') : null,
    a.source === 'google' ? h('span', { class: 'badge badge-info' }, icon('pin', { size: 12 }), 'Google listing') : null,
    a.licence_verified ? h('span', { class: 'badge badge-success' }, icon('shield', { size: 12 }), 'Licence verified') : null,
    a.decision_maker_name ? h('span', {}, `${a.decision_maker_name}${a.decision_maker_title ? `, ${a.decision_maker_title}` : ''}`) : null,
    titleAttr);

  const header = h('div', { class: 'agency-head' },
    h('div', { class: 'agency-title' }, h('a', { href: '#/agencies', class: 'small muted row' }, icon('chevronLeft', { size: 14 }), 'Agencies'), titleEl, meta),
    h('div', { class: 'page-actions' },
      stageSel,
      btn('Call', { iconName: 'phone', onClick: () => openQuickLog({ agencyId: id }), attrs: { 'data-tip': 'Log a call  (L)' } }),
      btn('Email', { iconName: 'mail', onClick: () => openQuickLog({ agencyId: id, channel: 'email' }), attrs: { 'data-tip': 'Log an email you sent' } }),
      btn('Task', { iconName: 'task', onClick: () => selectTab('tasks', { focusNew: true }) }),
      btn('', { iconName: 'more', title: 'More actions', onClick: (e) => moreMenu(e.currentTarget) })));

  function moreMenu() {
    const d = openDialog({
      title: 'More actions',
      body: h('div', { class: 'stack-sm' },
        btn('Research this agency', { iconName: 'sparkles', onClick: () => { d.close(); selectTab('research'); } }),
        h('a', { class: 'btn', href: `/api/export/my-data.json`, download: true }, icon('download'), 'Export my notes (JSON)'),
        h('hr', { class: 'divider' }),
        btn('Delete agency…', { kind: 'danger', iconName: 'trash', onClick: () => { d.close(); deleteAgency(); } })),
    });
  }

  function deleteAgency() {
    const name = agencyName(a);
    const confirmBtn = h('button', { type: 'button', class: 'btn btn-primary' }, 'Delete');
    const d = openDialog({
      title: 'Delete this agency?',
      body: h('p', {}, `"${name}" and all its calls, tasks, demos and research runs will be deleted. You can undo for 5 seconds.`),
      footer: [h('button', { type: 'button', class: 'btn', onclick: () => d.close() }, 'Cancel'), confirmBtn],
    });
    confirmBtn.addEventListener('click', () => {
      d.close();
      withUndo(`Deleted "${name}"`, {
        hideFn: () => { pendingDeletes.add(id); location.hash = '#/agencies'; },
        restoreFn: () => { pendingDeletes.delete(id); location.hash = `#/agency/${id}`; },
        commit: async () => { await api(`/agencies/${id}`, { method: 'DELETE' }); pendingDeletes.delete(id); notifyChange({ kind: 'delete' }); },
      });
    });
  }

  // ---------- Tabs ----------
  const counts = { calls: data.calls.length, tasks: data.tasks.filter((t) => t.status === 'open').length };
  const tablist = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Agency sections' });
  const panel = h('div', { role: 'tabpanel', tabindex: '-1' });
  const tabButtons = TABS.map(([key, label, ic]) => {
    const b = h('button', { type: 'button', class: 'tab', role: 'tab', id: `tab-${key}`, 'aria-controls': 'agency-panel', 'aria-selected': String(key === tab), tabindex: key === tab ? '0' : '-1' },
      icon(ic, { size: 15 }), label, counts[key] ? h('span', { class: 'count' }, String(counts[key])) : null);
    b.addEventListener('click', () => selectTab(key));
    return b;
  });
  tablist.append(...tabButtons);
  tablist.addEventListener('keydown', (e) => {
    const i = TABS.findIndex(([k]) => k === tab);
    let next = null;
    if (e.key === 'ArrowRight') next = (i + 1) % TABS.length;
    if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = TABS.length - 1;
    if (next !== null) { e.preventDefault(); selectTab(TABS[next][0]); tabButtons[next].focus(); }
  });
  panel.id = 'agency-panel';

  const panes = {};
  ctx.invalidate = (key) => { delete panes[key]; };
  async function selectTab(key, opts = {}) {
    tab = key;
    tabButtons.forEach((b, i) => { const on = TABS[i][0] === key; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    panel.setAttribute('aria-labelledby', `tab-${key}`);
    const q = new URLSearchParams(params.query);
    q.set('tab', key);
    q.delete('new');
    history.replaceState(null, '', `#/agency/${id}?${q}`);
    // Panes are built once and kept, so switching tabs is instant and the
    // live Google card is not re-fetched.
    if (!panes[key]) {
      const builders = { overview: overviewTab, research: researchTab, calls: callsTab, tasks: tasksTab, notes: notesTab };
      try { panes[key] = await builders[key](ctx); } catch (e) { panes[key] = errorBox(e.message); }
    }
    if (tab !== key) return;
    panel.replaceChildren(panes[key]);
    if (opts.focusNew || params.query.get('new')) { const f = panel.querySelector('[data-new]'); if (f) f.focus(); }
  }

  // ---------- Timeline ----------
  const timelineList = h('ol', { class: 'timeline', 'aria-label': 'Activity' });
  const TL_ICON = { call: 'phone', task: 'task', task_done: 'check', demo: 'calendar', stage: 'pipeline', research: 'sparkles', accept: 'check', licence: 'shield', created: 'plus' };
  async function loadTimeline() {
    try {
      const { items } = await api(`/agencies/${id}/timeline`);
      if (!items.length) { timelineList.replaceChildren(h('li', { class: 'subtle small' }, 'Nothing yet.')); return; }
      timelineList.replaceChildren(...items.map((it) => h('li', {},
        h('span', { class: 'tl-dot' }, icon(TL_ICON[it.kind] || 'clock')),
        h('div', { class: 'tl-title' }, it.kind === 'call' ? `${LABELS.channel[it.title.split(':')[0]] || 'Call'}: ${LABELS.outcome[it.title.split(': ')[1]] || ''}` : it.title),
        h('div', { class: 'tl-time' }, fmtDateTime(it.at)))));
    } catch (e) {
      timelineList.replaceChildren(h('li', { class: 'small overdue-text' }, `Could not load activity: ${e.message}`));
    }
  }
  ctx.refreshTimeline = loadTimeline;
  const side = h('aside', { class: 'agency-side', 'aria-label': 'Activity timeline' },
    h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', {}, icon('clock'), 'Activity')), timelineList));

  root.append(header, h('div', { class: 'agency-layout' }, h('div', {}, tablist, panel), side));
  timelineList.append(h('li', {}, h('span', { class: 'skeleton skeleton-line' })));
  loadTimeline();
  await selectTab(tab);

  // Another part of the app changed this agency (quick-log call, task added…).
  // Only the affected panes are rebuilt (never the live Google card, so no
  // extra Google call is made).
  listenWhileCurrent(params, 'hq:changed', async (e) => {
    if (e.detail && e.detail.silent) return;
    if (e.detail && e.detail.agencyId && e.detail.agencyId !== id) return;
    try {
      const fresh = await api(`/agencies/${id}`);
      ctx.data = fresh;
      Object.assign(a, fresh.agency);
      counts.calls = fresh.calls.length;
      counts.tasks = fresh.tasks.filter((t) => t.status === 'open').length;
      tabButtons.forEach((b, i) => {
        const key = TABS[i][0];
        const c = b.querySelector('.count');
        if (counts[key]) { if (c) c.textContent = String(counts[key]); else b.append(h('span', { class: 'count' }, String(counts[key]))); } else if (c) c.remove();
      });
      delete panes.calls;
      delete panes.tasks;
      if (tab === 'calls' || tab === 'tasks') await selectTab(tab);
      loadTimeline();
    } catch (err) { toast(`Could not refresh: ${err.message}`, { kind: 'error' }); }
  });
}
