// Calls and Tasks (+ demos) tabs. Optimistic updates with rollback; deletes
// wait out an Undo window before the request is sent.
import { api } from '../api.js';
import { h, btn, field, emptyState, fmtDate, fmtDateTime, LABELS, todayLocal, formData } from '../dom.js';
import { icon } from '../icons.js';
import { toast, withUndo } from '../ui/toast.js';
import { openQuickLog } from '../ui/quicklog.js';
import { saveIndicator, bindAutosave } from '../ui/autosave.js';
import { DISCOVERY_QUESTIONS } from './script.js';

export async function callsTab(ctx) {
  const { calls } = ctx.data;
  const list = h('div');
  const head = h('div', { class: 'card-head' }, h('h2', {}, icon('phone'), 'Call log'),
    h('div', { class: 'row' },
      btn('Log email', { size: 'sm', iconName: 'mail', onClick: () => openQuickLog({ agencyId: ctx.id, channel: 'email' }) }),
      btn('Log call', { size: 'sm', kind: 'primary', iconName: 'phone', onClick: () => openQuickLog({ agencyId: ctx.id }), attrs: { 'data-new': '' } })));
  if (!calls.length) {
    list.append(emptyState({ iconName: 'phone', title: 'No calls yet', text: 'Open the call script on the Overview tab, make the call, then log what happened.', actions: [btn('Log a call', { kind: 'primary', iconName: 'phone', onClick: () => openQuickLog({ agencyId: ctx.id }) })] }));
  }
  for (const c of calls) {
    const answered = DISCOVERY_QUESTIONS.filter(([k]) => c[k]);
    const item = h('article', { class: 'call' },
      h('div', { class: 'call-head' },
        h('strong', { class: 'num' }, fmtDateTime(c.contacted_at)),
        h('span', { class: 'badge' }, icon(c.channel === 'email' ? 'mail' : 'phone', { size: 12 }), LABELS.channel[c.channel]),
        h('span', { class: ['conversation', 'meeting_booked'].includes(c.outcome) ? 'badge badge-success' : c.outcome === 'not_interested' ? 'badge badge-danger' : 'badge' }, LABELS.outcome[c.outcome]),
        c.contact_person ? h('span', { class: 'muted' }, c.contact_person) : null,
        h('span', { class: 'spacer' }),
        btn('', { size: 'sm', kind: 'ghost', iconName: 'trash', title: 'Delete call', onClick: () => withUndo('Call deleted', {
          hideFn: () => { item.hidden = true; },
          restoreFn: () => { item.hidden = false; },
          commit: async () => { await api(`/calls/${c.id}`, { method: 'DELETE' }); ctx.refreshTimeline(); },
        }) })),
      c.notes ? h('p', { class: 'call-notes pre' }, c.notes) : null,
      answered.length ? h('dl', { class: 'qa' }, answered.map(([k, label]) => [h('dt', {}, label), h('dd', { class: 'pre' }, c[k])])) : null,
      c.next_action ? h('p', { class: 'small muted', vars: { 'margin-top': '8px' } }, icon('chevronRight', { size: 12 }), ` Next: ${c.next_action}${c.next_action_date ? ` · ${fmtDate(c.next_action_date)}` : ''}`) : null);
    list.append(item);
  }
  return h('section', { class: 'card' }, head, list);
}

export async function tasksTab(ctx) {
  const today = todayLocal();
  const { tasks, demos } = ctx.data;

  // ---- Tasks ----
  const listEl = h('ul', { class: 'list' });
  function taskRow(t) {
    const li = h('li', { class: `list-item ${t.status === 'done' ? 'is-done' : ''}` });
    const box = h('input', { type: 'checkbox', checked: t.status === 'done', 'aria-label': `Done: ${t.title}` });
    box.addEventListener('change', async () => {
      const next = box.checked ? 'done' : 'open';
      li.classList.toggle('is-done', box.checked); // optimistic
      try {
        await api(`/tasks/${t.id}`, { method: 'PATCH', body: { status: next } });
        t.status = next;
        ctx.refreshTimeline();
      } catch (e) {
        box.checked = !box.checked;
        li.classList.toggle('is-done', box.checked);
        toast(`Could not update: ${e.message}`, { kind: 'error' });
      }
    });
    li.append(box,
      h('div', { class: 'li-main' }, h('span', { class: 'li-title' }, t.title)),
      h('span', { class: `li-date ${t.status === 'open' && t.due_date && t.due_date < today ? 'overdue-text' : ''}` }, t.due_date ? fmtDate(t.due_date) : 'No date'),
      btn('', { size: 'sm', kind: 'ghost', iconName: 'trash', title: 'Delete task', onClick: () => withUndo('Task deleted', {
        hideFn: () => { li.hidden = true; },
        restoreFn: () => { li.hidden = false; },
        commit: () => api(`/tasks/${t.id}`, { method: 'DELETE' }),
      }) }));
    return li;
  }
  const sorted = tasks.slice().sort((x, y) => (x.status === y.status ? (x.due_date || '9999') < (y.due_date || '9999') ? -1 : 1 : x.status === 'open' ? -1 : 1));
  listEl.append(...sorted.map(taskRow));
  const empty = emptyState({ iconName: 'task', small: true, title: 'No tasks', text: 'Add one above, or log a call with a next action.' });
  if (!tasks.length) listEl.append(h('li', {}, empty));

  const title = h('input', { name: 'title', required: true, maxlength: 300, placeholder: 'Add a task…', 'aria-label': 'New task', 'data-new': '' });
  const due = h('input', { name: 'due_date', type: 'date', value: todayLocal(1), 'aria-label': 'Due date' });
  const addForm = h('form', { class: 'row-end card-pad', vars: { 'border-bottom': '1px solid var(--border)' } },
    h('div', { class: 'field', vars: { flex: '1 1 260px' } }, title), h('div', { class: 'field', vars: { flex: '0 0 170px' } }, due),
    h('button', { type: 'submit', class: 'btn btn-primary' }, icon('plus'), 'Add'));
  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!title.value.trim()) { title.focus(); return; }
    const body = { title: title.value, due_date: due.value || null, agency_id: ctx.id };
    const temp = { id: null, title: body.title, due_date: body.due_date, status: 'open' };
    const li = taskRow(temp);
    li.classList.add('view-enter');
    if (!tasks.length) listEl.replaceChildren();
    listEl.prepend(li); // optimistic
    title.value = '';
    try {
      const r = await api('/tasks', { method: 'POST', body });
      temp.id = r.id;
      ctx.data.tasks.push(temp);
      ctx.refreshTimeline();
    } catch (err) {
      li.remove();
      title.value = body.title;
      toast(`Task not added: ${err.message}`, { kind: 'error' });
    }
    title.focus();
  });

  // ---- Demos ----
  const demoList = h('ul', { class: 'list' });
  function demoRow(d) {
    const ind = saveIndicator();
    const outcome = h('input', { name: 'outcome', value: d.outcome || '', maxlength: 2000, placeholder: 'Outcome (autosaves)', 'aria-label': 'Demo outcome' });
    bindAutosave([outcome], (body) => api(`/demos/${d.id}`, { method: 'PATCH', body }), ind);
    const li = h('li', { class: 'list-item' },
      icon('calendar'),
      h('div', { class: 'li-main' }, h('span', { class: 'li-title num' }, fmtDateTime(d.scheduled_at)), d.notes ? h('span', { class: 'li-sub' }, d.notes) : null),
      h('div', { vars: { width: '40%' } }, outcome), ind.el,
      btn('', { size: 'sm', kind: 'ghost', iconName: 'trash', title: 'Delete demo', onClick: () => withUndo('Demo deleted', {
        hideFn: () => { li.hidden = true; }, restoreFn: () => { li.hidden = false; },
        commit: () => api(`/demos/${d.id}`, { method: 'DELETE' }),
      }) }));
    return li;
  }
  demoList.append(...demos.map(demoRow));
  if (!demos.length) demoList.append(h('li', {}, emptyState({ iconName: 'calendar', small: true, title: 'No demos yet', text: 'Schedule one after a good conversation. You demonstrate with fictional documents only.' })));
  const demoForm = h('form', { class: 'row-end card-pad', vars: { 'border-bottom': '1px solid var(--border)' } },
    field('When', h('input', { name: 'scheduled_at', type: 'datetime-local', required: true })),
    field('Notes', h('input', { name: 'notes', maxlength: 4000, placeholder: 'Optional' })),
    h('button', { type: 'submit', class: 'btn' }, icon('calendar'), 'Schedule'));
  demoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api(`/agencies/${ctx.id}/demos`, { method: 'POST', body: formData(demoForm) });
      toast('Demo scheduled');
      window.dispatchEvent(new CustomEvent('hq:changed', { detail: { agencyId: ctx.id, kind: 'demo' } }));
    } catch (err) { toast(err.message, { kind: 'error' }); }
  });

  return h('div', { class: 'stack' },
    h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', {}, icon('task'), 'Tasks')), addForm, listEl),
    h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', {}, icon('calendar'), 'Demos')), demoForm, demoList));
}
