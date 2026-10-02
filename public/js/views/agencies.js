// Agencies list: instant search, filters, sortable columns, keyboard navigation.
// Names here are YOUR data only (manual name or your label); Google details
// are fetched live on the agency page, never listed in bulk.
import { api } from '../api.js';
import { h, emptyState, agencyName, stageBadge, LABELS, fmtDate, todayLocal } from '../dom.js';
import { icon } from '../icons.js';
import { pendingDeletes } from '../store.js';

const FILTER_KEY = 'hq.agencyFilters';

function loadFilters(query) {
  let f = { q: '', stage: '', apt: '', fit: '', due: '', sort: 'next_follow_up', dir: 'asc' };
  try { f = { ...f, ...JSON.parse(sessionStorage.getItem(FILTER_KEY) || '{}') }; } catch { /* ignore */ }
  if (query.get('stage')) f.stage = query.get('stage');
  return f;
}

const COLUMNS = [
  ['name', 'Agency'], ['pipeline_stage', 'Stage'], ['handles_apartments', 'Apartments'],
  ['fit_score', 'Fit'], ['next_follow_up', 'Next follow-up'], ['last_contact', 'Last contact'],
];

export async function render(root, { query }) {
  const agencies = (await api('/agencies')).agencies.filter((a) => !pendingDeletes.has(a.id));
  const f = loadFilters(query);
  const today = todayLocal();
  const in7 = todayLocal(7);

  if (!agencies.length) {
    root.append(h('div', { class: 'page-head' }, h('h1', {}, 'Agencies')),
      h('div', { class: 'card' }, emptyState({
        iconName: 'building', title: 'No agencies yet', text: 'Search Google for apartment-insurance agencies, or add one you found yourself.',
        actions: [h('a', { class: 'btn btn-primary', href: '#/search' }, icon('search'), 'Search Google'), h('a', { class: 'btn', href: '#/agencies/new' }, icon('plus'), 'Add by hand')],
      })));
    return;
  }

  const search = h('input', { type: 'search', placeholder: 'Search agencies…', 'aria-label': 'Search agencies', value: f.q, 'data-search': '' });
  const mk = (name, label, opts) => {
    const s = h('select', { 'aria-label': label }, opts.map(([v, t]) => h('option', { value: v }, t)));
    s.value = f[name];
    s.addEventListener('change', () => { f[name] = s.value; draw(); });
    return s;
  };
  const stageSel = mk('stage', 'Filter by stage', [['', 'All stages'], ...Object.entries(LABELS.stage)]);
  const aptSel = mk('apt', 'Filter by apartments', [['', 'Apartments: any'], ['yes', 'Apartments: yes'], ['no', 'Apartments: no'], ['unknown', 'Apartments: unknown']]);
  const fitSel = mk('fit', 'Filter by fit score', [['', 'Fit: any'], ['80', 'Fit ≥ 80'], ['60', 'Fit ≥ 60'], ['40', 'Fit ≥ 40'], ['none', 'Not researched']]);
  const dueSel = mk('due', 'Filter by follow-up', [['', 'Follow-up: any'], ['overdue', 'Overdue'], ['week', 'Due within 7 days'], ['none', 'No follow-up']]);
  const count = h('span', { class: 'muted small num', 'aria-live': 'polite' });
  const clearBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-sm' }, icon('x', { size: 14 }), 'Clear');
  clearBtn.addEventListener('click', () => {
    Object.assign(f, { q: '', stage: '', apt: '', fit: '', due: '' });
    search.value = ''; stageSel.value = ''; aptSel.value = ''; fitSel.value = ''; dueSel.value = '';
    draw();
  });
  search.addEventListener('input', () => { f.q = search.value; draw(); });

  const thead = h('thead');
  const tbody = h('tbody');
  const table = h('table', { class: 'table', 'aria-label': 'Agencies' }, thead, tbody);

  function value(a, key) {
    if (key === 'name') return agencyName(a).toLowerCase();
    return a[key];
  }

  function rows() {
    const q = f.q.trim().toLowerCase();
    let list = agencies.filter((a) => {
      if (q && !`${agencyName(a)} ${a.decision_maker_name || ''}`.toLowerCase().includes(q)) return false;
      if (f.stage && a.pipeline_stage !== f.stage) return false;
      if (f.apt && a.handles_apartments !== f.apt) return false;
      if (f.fit === 'none' && a.fit_score !== null) return false;
      if (f.fit && f.fit !== 'none' && !(a.fit_score >= Number(f.fit))) return false;
      if (f.due === 'overdue' && !(a.next_follow_up && a.next_follow_up < today)) return false;
      if (f.due === 'week' && !(a.next_follow_up && a.next_follow_up <= in7)) return false;
      if (f.due === 'none' && a.next_follow_up) return false;
      return true;
    });
    const dir = f.dir === 'desc' ? -1 : 1;
    list = list.slice().sort((a, b) => {
      const va = value(a, f.sort);
      const vb = value(b, f.sort);
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1; // empty values last
      if (vb === null || vb === undefined) return -1;
      return va < vb ? -dir : dir;
    });
    return list;
  }

  function drawHead() {
    thead.replaceChildren(h('tr', {}, COLUMNS.map(([key, label]) => {
      const active = f.sort === key;
      const b = h('button', { type: 'button' }, label, active ? icon(f.dir === 'asc' ? 'sortUp' : 'sortDown', { size: 14 }) : null);
      b.addEventListener('click', () => {
        if (f.sort === key) f.dir = f.dir === 'asc' ? 'desc' : 'asc';
        else { f.sort = key; f.dir = key === 'fit_score' ? 'desc' : 'asc'; }
        draw();
      });
      return h('th', { scope: 'col', 'aria-sort': active ? (f.dir === 'asc' ? 'ascending' : 'descending') : 'none' }, b);
    })));
  }

  function draw() {
    try { sessionStorage.setItem(FILTER_KEY, JSON.stringify({ ...f })); } catch { /* ignore */ }
    drawHead();
    const list = rows();
    count.textContent = `${list.length} of ${agencies.length}`;
    clearBtn.hidden = !(f.q || f.stage || f.apt || f.fit || f.due);
    if (!list.length) {
      tbody.replaceChildren(h('tr', {}, h('td', { colspan: COLUMNS.length }, emptyState({ iconName: 'search', small: true, title: 'No matches', text: 'Try clearing a filter.' }))));
      return;
    }
    tbody.replaceChildren(...list.map((a) => {
      const due = a.next_follow_up;
      const tr = h('tr', { class: 'clickable', tabindex: '0', dataset: { id: a.id }, 'aria-label': `Open ${agencyName(a)}` },
        h('td', {},
          h('div', { class: 'cell-title' }, agencyName(a),
            a.source === 'sample' ? h('span', { class: 'badge badge-sample', vars: { 'margin-left': '8px' } }, 'fake sample') : null),
          h('div', { class: 'cell-sub' },
            a.source === 'manual' ? 'Added by hand' : a.source === 'google' ? (a.label ? 'Google listing' : 'Google listing · open for live details') : 'Fictional',
            a.decision_maker_name ? ` · ${a.decision_maker_name}` : '')),
        h('td', {}, stageBadge(a.pipeline_stage)),
        h('td', {}, h('span', { class: a.handles_apartments === 'yes' ? 'badge badge-success' : a.handles_apartments === 'no' ? 'badge badge-danger' : 'badge' }, LABELS.apartments[a.handles_apartments])),
        h('td', {}, a.fit_score === null || a.fit_score === undefined
          ? h('span', { class: 'subtle small' }, '-')
          : h('span', { class: 'fit-pill' }, String(a.fit_score), h('span', { class: 'bar' }, h('i', { vars: { '--w': `${a.fit_score}%` } })))),
        h('td', { class: `num ${due && due < today ? 'overdue-text' : ''}` }, due ? fmtDate(due) : h('span', { class: 'subtle' }, '-')),
        h('td', { class: 'num muted' }, a.last_contact ? fmtDate(a.last_contact) : '-'));
      tr.addEventListener('click', (e) => { if (!e.target.closest('a,button')) location.hash = `#/agency/${a.id}`; });
      return tr;
    }));
  }

  // Keyboard: j/k or arrows move between rows, Enter opens.
  table.addEventListener('keydown', (e) => {
    const tr = e.target.closest('tbody tr[data-id]');
    if (!tr) return;
    if (e.key === 'Enter') { e.preventDefault(); location.hash = `#/agency/${tr.dataset.id}`; }
    else if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); (tr.nextElementSibling || tr).focus(); }
    else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); (tr.previousElementSibling || tr).focus(); }
  });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter') { const first = tbody.querySelector('tr[data-id]'); if (first) { e.preventDefault(); first.focus(); } }
    if (e.key === 'Escape') search.blur();
  });

  root.append(
    h('div', { class: 'page-head' },
      h('div', {}, h('h1', {}, 'Agencies'), h('p', { class: 'lede' }, 'Your saved agencies. Press ', h('kbd', {}, '/'), ' to search, ', h('kbd', {}, 'j'), ' ', h('kbd', {}, 'k'), ' to move, ', h('kbd', {}, '↵'), ' to open.')),
      h('div', { class: 'page-actions' },
        h('a', { class: 'btn', href: '#/agencies/new' }, icon('plus'), h('span', {}, 'Add by hand')),
        h('a', { class: 'btn btn-primary', href: '#/search' }, icon('search'), h('span', {}, 'Find agencies')))),
    h('div', { class: 'toolbar' },
      h('div', { class: 'search-input' }, icon('search'), search), stageSel, aptSel, fitSel, dueSel, clearBtn, h('span', { class: 'spacer' }), count),
    h('div', { class: 'table-wrap' }, table));
  draw();
  if (sessionStorage.getItem('hq.focusSearch')) { sessionStorage.removeItem('hq.focusSearch'); setTimeout(() => search.focus(), 0); }
}
