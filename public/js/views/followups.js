// Follow-ups: overdue and today's tasks, the next 7 days, and upcoming demos.
import { api } from '../api.js';
import { h, agencyName, fmtDateTime, toast } from '../dom.js';

export async function render(root) {
  const data = await api('/followups');
  const rerender = () => { root.replaceChildren(); return render(root); };

  function taskList(tasks, empty, cls = '') {
    if (!tasks.length) return h('p', { class: 'muted' }, empty);
    return h('ul', { class: 'task-list' }, tasks.map((t) => h('li', { class: cls },
      h('input', { type: 'checkbox', 'aria-label': 'Mark done', onchange: async (e) => {
        e.target.disabled = true;
        try {
          await api(`/tasks/${t.id}`, { method: 'PATCH', body: { status: 'done' } });
          toast('Task done.');
          rerender();
        } catch (err) { e.target.disabled = false; e.target.checked = false; toast(err.message, 'error'); }
      } }),
      h('span', { class: 'task-date' }, t.due_date || ''),
      h('span', {}, t.title),
      t.agency_id ? h('a', { href: `#/agency/${t.agency_id}`, class: 'small' }, agencyName({ ...t, label: t.agency_name, id: t.agency_id })) : null)));
  }

  root.append(
    h('h1', {}, 'Follow-ups'),
    h('section', { class: 'card' }, h('h2', {}, `Overdue (${data.overdue.length})`), taskList(data.overdue, 'Nothing overdue.', 'overdue')),
    h('section', { class: 'card' }, h('h2', {}, `Today (${data.today.length})`), taskList(data.today, 'Nothing due today.')),
    h('section', { class: 'card' }, h('h2', {}, 'Next 7 days'), taskList(data.upcoming, 'Nothing scheduled.')),
    h('section', { class: 'card' }, h('h2', {}, 'Upcoming demos'),
      data.demos.length
        ? h('ul', { class: 'task-list' }, data.demos.map((d) => h('li', {},
          h('span', { class: 'task-date' }, fmtDateTime(d.scheduled_at)),
          h('a', { href: `#/agency/${d.agency_id}` }, agencyName({ label: d.agency_name, id: d.agency_id })),
          d.notes ? h('span', { class: 'muted' }, ` - ${d.notes}`) : null)))
        : h('p', { class: 'muted' }, 'No demos scheduled.')),
    data.undated.length
      ? h('section', { class: 'card' }, h('h2', {}, 'No date set'), taskList(data.undated, ''))
      : '');
}
