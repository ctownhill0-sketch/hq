// "Today" dashboard: what needs doing now, pipeline snapshot, research to do.
import { api } from '../api.js';
import { h, btn, emptyState, agencyName, fmtDate, fmtDateTime, stageBadge, LABELS, STAGE_ORDER, todayLocal, field } from '../dom.js';
import { icon } from '../icons.js';
import { toast } from '../ui/toast.js';
import { openQuickLog } from '../ui/quicklog.js';
import { openDialog } from '../ui/dialog.js';
import { notifyChange } from '../store.js';
import { listenWhileCurrent, rerender } from './util.js';

export async function render(root, params) {
  const [d, g, r] = await Promise.all([api('/dashboard'), api('/status'), api('/research/status')]);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const dueCount = d.overdue.length + d.today.length;

  root.append(
    h('div', { class: 'page-head' },
      h('div', {},
        h('h1', {}, greeting),
        h('p', { class: 'lede' }, new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }), ' · ',
          dueCount ? `${dueCount} follow-up${dueCount === 1 ? '' : 's'} need you today` : 'Nothing due today')),
      h('div', { class: 'page-actions' },
        btn('Log call', { iconName: 'phone', onClick: () => openQuickLog() }),
        btn('Add task', { iconName: 'task', onClick: () => addTaskDialog() }),
        h('a', { class: 'btn btn-primary', href: '#/search' }, icon('search'), h('span', {}, 'Find agencies')))),

    h('div', { class: 'grid grid-4' },
      stat('Agencies', d.stats.agencies, 'building', 'in your workspace'),
      stat('Calls (7 days)', d.stats.calls_week, 'phone', 'logged this week'),
      stat('Conversations (7 days)', d.stats.conversations_week, 'message', 'unique agencies'),
      stat('Open tasks', d.stats.open_tasks, 'task', `${d.overdue.length} overdue`)),

    h('div', { class: 'today-grid' },
      h('div', { class: 'stack' },
        h('section', { class: 'card', 'aria-labelledby': 'h-follow' },
          h('div', { class: 'card-head' }, h('h2', { id: 'h-follow' }, icon('clock'), 'Follow-ups'), h('span', { class: 'badge num' }, String(dueCount))),
          followups(d)),
        h('section', { class: 'card', 'aria-labelledby': 'h-demos' },
          h('div', { class: 'card-head' }, h('h2', { id: 'h-demos' }, icon('calendar'), 'Scheduled demos')),
          d.demos.length
            ? h('ul', { class: 'list' }, d.demos.map((x) => h('li', { class: 'list-item' },
              h('div', { class: 'li-main' }, h('a', { class: 'li-title', href: `#/agency/${x.agency_id}?tab=tasks` }, agencyName({ ...x, id: x.agency_id })),
                x.notes ? h('span', { class: 'li-sub' }, x.notes) : null),
              h('span', { class: 'li-date' }, fmtDateTime(x.scheduled_at)))))
            : emptyState({ iconName: 'calendar', small: true, title: 'No demos scheduled', text: 'Book one from an agency\'s Tasks tab after a good conversation.' }))),

      h('div', { class: 'stack' },
        pipelineCard(d.pipeline),
        h('section', { class: 'card', 'aria-labelledby': 'h-research' },
          h('div', { class: 'card-head' }, h('h2', { id: 'h-research' }, icon('sparkles'), 'Needs research')),
          d.needs_research.length
            ? h('ul', { class: 'list' }, d.needs_research.map((a) => h('li', { class: 'list-item' },
              h('div', { class: 'li-main' }, h('span', { class: 'li-title' }, agencyName(a))), stageBadge(a.pipeline_stage),
              h('a', { class: 'btn btn-sm', href: `#/agency/${a.id}?tab=research` }, icon('sparkles', { size: 14 }), 'Research'))))
            : emptyState({ iconName: 'check', small: true, title: 'All caught up', text: 'Every active agency has a research run.' })),
        h('section', { class: 'card card-pad', 'aria-labelledby': 'h-usage' },
          h('h2', { id: 'h-usage', class: 'row' }, icon('shield'), 'Daily limits'),
          h('div', { class: 'stack-sm', vars: { 'margin-top': '12px' } },
            usageLine('Google calls', g.googleEnabled ? `${g.usage.usedToday} / ${g.usage.perDay}` : 'off (no key)'),
            usageLine('Research runs', r.research.enabled ? `${r.research.runsToday} / ${r.research.runsPerDay}` : 'off'),
            usageLine('Research spend', r.research.enabled ? `$${r.research.spendTodayUsd.toFixed(2)} / $${r.research.dailySpendCapUsd.toFixed(2)}` : 'off'))))));

  listenWhileCurrent(params, 'hq:changed', () => rerender());
  if (params.query.get('newtask')) setTimeout(() => addTaskDialog(), 50);
}

function stat(label, value, iconName, sub) {
  return h('div', { class: 'card stat' },
    h('span', { class: 'stat-label' }, icon(iconName, { size: 14 }), label),
    h('span', { class: 'stat-value' }, String(value)),
    h('span', { class: 'stat-sub' }, sub));
}

function usageLine(label, value) {
  return h('div', { class: 'row small' }, h('span', { class: 'muted' }, label), h('span', { class: 'spacer' }), h('strong', { class: 'num' }, value));
}

function followups(d) {
  const groups = [['Overdue', d.overdue, true], ['Today', d.today, false], ['Next 7 days', d.upcoming, false]];
  if (!d.overdue.length && !d.today.length && !d.upcoming.length) {
    return emptyState({ iconName: 'check', title: 'You\'re all caught up', text: 'No follow-ups due. Log a call with a next action and it shows up here.', actions: [btn('Log a call', { iconName: 'phone', onClick: () => openQuickLog() })] });
  }
  const wrap = h('div');
  for (const [label, tasks, overdue] of groups) {
    if (!tasks.length) continue;
    wrap.append(h('div', { class: 'section-label' }, label, h('span', { class: 'num' }, String(tasks.length))),
      h('ul', { class: 'list' }, tasks.map((t) => taskItem(t, overdue))));
  }
  return wrap;
}

// Optimistic "done" with rollback on error.
function taskItem(t, overdue) {
  const li = h('li', { class: 'list-item' });
  const box = h('input', { type: 'checkbox', 'aria-label': `Mark "${t.title}" done` });
  box.addEventListener('change', async () => {
    li.classList.toggle('is-done', box.checked);
    try {
      await api(`/tasks/${t.id}`, { method: 'PATCH', body: { status: box.checked ? 'done' : 'open' } });
      if (box.checked) toast('Task done', { action: { label: 'Undo', icon: 'undo', onClick: async () => { box.checked = false; li.classList.remove('is-done'); await api(`/tasks/${t.id}`, { method: 'PATCH', body: { status: 'open' } }).catch((e) => toast(e.message, { kind: 'error' })); } } });
    } catch (e) {
      box.checked = !box.checked;
      li.classList.toggle('is-done', box.checked);
      toast(`Could not update task: ${e.message}`, { kind: 'error' });
    }
  });
  li.append(box,
    h('div', { class: 'li-main' }, h('span', { class: 'li-title' }, t.title),
      t.agency_id ? h('a', { class: 'li-sub', href: `#/agency/${t.agency_id}` }, agencyName({ ...t, id: t.agency_id })) : h('span', { class: 'li-sub' }, 'No agency')),
    h('span', { class: `li-date ${overdue ? 'overdue-text' : ''}` }, fmtDate(t.due_date)));
  return li;
}

function pipelineCard(p) {
  const total = STAGE_ORDER.reduce((n, s) => n + (p[s] || 0), 0);
  return h('section', { class: 'card card-pad', 'aria-labelledby': 'h-pipe' },
    h('div', { class: 'row' }, h('h2', { id: 'h-pipe', class: 'row' }, icon('pipeline'), 'Pipeline'), h('span', { class: 'spacer' }), h('span', { class: 'muted small num' }, `${total} total`)),
    h('div', { class: 'pipeline-bar', vars: { 'margin-top': '14px' }, role: 'img', 'aria-label': STAGE_ORDER.map((s) => `${LABELS.stage[s]} ${p[s] || 0}`).join(', ') },
      STAGE_ORDER.filter((s) => p[s]).map((s) => h('span', { class: `stage-${s}`, vars: { '--n': String(p[s]) } }))),
    h('div', { class: 'pipeline-legend' }, STAGE_ORDER.map((s) => h('a', { href: `#/agencies?stage=${s}` }, stageBadge(s), h('span', { class: 'num muted' }, String(p[s] || 0))))));
}

async function addTaskDialog() {
  const { getAgencies } = await import('../store.js');
  const pick = h('select', { name: 'agency_id' }, h('option', { value: '' }, 'No agency'));
  const title = h('input', { name: 'title', required: true, maxlength: 300, placeholder: 'What needs doing?' });
  const due = h('input', { name: 'due_date', type: 'date', value: todayLocal(1) });
  const err = h('div', { role: 'alert' });
  const form = h('form', { class: 'stack' }, field('Task', title), h('div', { class: 'form-grid' }, field('Agency', pick, null, 'span-8'), field('Due', due, null, 'span-4')), err,
    h('div', { class: 'row' }, h('span', { class: 'spacer' }), h('button', { class: 'btn btn-primary', type: 'submit' }, 'Add task')));
  const dlg = openDialog({ title: 'Add task', body: form, initialFocus: title });
  getAgencies().then((list) => pick.append(...list.map((a) => h('option', { value: a.id }, agencyName(a))))).catch(() => {});
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/tasks', { method: 'POST', body: { title: title.value, due_date: due.value || null, agency_id: pick.value || null } });
      dlg.close();
      toast('Task added');
      notifyChange({ kind: 'task' });
    } catch (x) { err.replaceChildren(h('div', { class: 'callout callout-danger' }, x.message)); }
  });
}
