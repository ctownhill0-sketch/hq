// Saved agencies. Names shown here are your own data only (manual name or
// the label you typed). Google details are only fetched on the agency page.
import { api } from '../api.js';
import { h, LABELS, agencyName, todayLocal } from '../dom.js';

export async function render(root) {
  const { agencies } = await api('/agencies');
  const stageFilter = h('select', {}, h('option', { value: '' }, 'All stages'),
    Object.entries(LABELS.stage).map(([v, t]) => h('option', { value: v }, t)));
  const tbody = h('tbody');
  const today = todayLocal();

  function draw() {
    tbody.replaceChildren();
    const rows = agencies.filter((a) => !stageFilter.value || a.pipeline_stage === stageFilter.value);
    if (!rows.length) {
      tbody.append(h('tr', {}, h('td', { colspan: 5, class: 'muted' }, 'No agencies yet. Use "Find agencies" or "Add by hand".')));
      return;
    }
    for (const a of rows) {
      const due = a.next_follow_up;
      tbody.append(h('tr', {},
        h('td', {}, h('a', { href: `#/agency/${a.id}` }, agencyName(a)),
          a.source === 'sample' ? h('span', { class: 'tag tag-sample' }, 'fake sample') : null,
          a.source === 'manual' ? h('span', { class: 'tag' }, 'added by hand') : null,
          a.source === 'google' && !a.label ? h('span', { class: 'hint' }, ' open to view live details') : null),
        h('td', {}, h('span', { class: `stage stage-${a.pipeline_stage}` }, LABELS.stage[a.pipeline_stage])),
        h('td', {}, LABELS.apartments[a.handles_apartments]),
        h('td', { class: due && due < today ? 'overdue' : '' }, due || '-'),
        h('td', { class: 'muted' }, a.last_contact ? a.last_contact.slice(0, 10) : '-')));
    }
  }
  stageFilter.addEventListener('change', draw);

  root.append(
    h('div', { class: 'page-head' }, h('h1', {}, `Agencies (${agencies.length})`),
      h('div', {}, stageFilter, ' ', h('a', { class: 'btn', href: '#/agencies/new' }, 'Add by hand'), ' ',
        h('a', { class: 'btn btn-primary', href: '#/search' }, 'Find agencies'))),
    h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, ['Agency', 'Stage', 'Apartments?', 'Next follow-up', 'Last contact'].map((t) => h('th', {}, t)))),
      tbody));
  draw();
}
