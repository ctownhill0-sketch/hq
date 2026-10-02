// Agency page: live Google details (never stored), then your own data:
// qualification, call log with discovery answers, tasks, demos and notes.
import { api } from '../api.js';
import {
  h, clear, errorBox, notice, extLink, field, select, formData, toast, googleAttribution,
  LABELS, agencyName, nowLocalMinutes, fmtDateTime, todayLocal,
} from '../dom.js';
import { scriptPanel, DISCOVERY_QUESTIONS } from './script.js';

export async function render(root, { match }) {
  const id = match[1];
  const data = await api(`/agencies/${id}`);
  const a = data.agency;
  const reload = () => { root.replaceChildren(); return render(root, { match }).catch((e) => root.append(errorBox(e.message))); };

  root.append(
    h('div', { class: 'page-head' },
      h('h1', {}, agencyName(a),
        a.source === 'sample' ? h('span', { class: 'tag tag-sample' }, 'fake sample') : null),
      h('button', { class: 'btn btn-danger btn-small', type: 'button', onclick: async () => {
        if (!confirm('Delete this agency and all its calls, tasks and demos? This cannot be undone.')) return;
        try { await api(`/agencies/${id}`, { method: 'DELETE' }); toast('Deleted.'); location.hash = '#/agencies'; } catch (e) { toast(e.message, 'error'); }
      } }, 'Delete agency')),
    a.source === 'google' ? googleCard(a) : manualCard(a, reload),
    scriptPanel(a.decision_maker_name),
    qualificationForm(a, reload),
    callsSection(a, data.calls, reload),
    tasksSection(a, data.tasks, reload),
    demosSection(a, data.demos, reload));
}

// ---- Live Google details --------------------------------------------------
// GOOGLE RULE 2: fetched live on every visit, displayed, never saved.
// GOOGLE RULE 4: attribution shown with the data.
// GOOGLE RULE 5: NOT_FOUND shows "Listing no longer available" + relink.
function googleCard(a) {
  const card = h('section', { class: 'card google-card' }, h('p', { class: 'muted' }, 'Loading live details from Google…'));
  async function load() {
    clear(card).append(h('p', { class: 'muted' }, 'Loading live details from Google…'));
    try {
      const { place: p } = await api(`/places/${encodeURIComponent(a.place_id)}`);
      clear(card).append(
        h('div', { class: 'card-label' }, 'Live from Google (not stored)'),
        h('h2', {}, p.name || '(no name)'),
        p.businessStatus && p.businessStatus !== 'OPERATIONAL' ? h('p', {}, h('span', { class: 'tag tag-warn' }, p.businessStatus)) : '',
        h('p', {}, p.address || ''),
        h('p', { class: 'links' },
          p.website ? extLink(p.website, 'Website') : h('span', { class: 'muted' }, 'No website'),
          ' · ', p.mapsUrl ? extLink(p.mapsUrl, 'View on Google Maps') : '',
          p.phone ? ` · ${p.phone}` : ''),
        googleAttribution(p.attributions));
    } catch (e) {
      clear(card);
      if (e.code === 'NOT_FOUND') {
        card.append(h('div', { class: 'alert alert-warn' },
          h('strong', {}, 'Listing no longer available. '),
          'Google no longer recognises this saved place ID. The agency may have moved, closed or merged listings. Your notes are safe.',
          h('div', {}, h('a', { class: 'btn btn-small', href: `#/search?relink=${a.id}` }, 'Search again to relink'))));
      } else if (e.code === 'NO_KEY') {
        card.append(notice('Google details are unavailable: no API key in .env. Your own data below still works.', 'warn'));
      } else {
        card.append(errorBox(`Could not load Google details. ${e.message}`, load));
      }
    }
  }
  load();
  return card;
}

function manualCard(a, reload) {
  const form = h('form', { class: 'card stack', onsubmit: async (e) => {
    e.preventDefault();
    try { await api(`/agencies/${a.id}`, { method: 'PATCH', body: formData(form) }); toast('Saved.'); reload(); } catch (err) { toast(err.message, 'error'); }
  } },
  h('div', { class: 'card-label' }, a.source === 'sample' ? 'Fictional sample data' : 'Your own data (added by hand, not from Google)'),
  h('div', { class: 'grid-3' },
    field('Name', h('input', { name: 'manual_name', value: a.manual_name || '', required: true, maxlength: 200 })),
    field('Website', h('input', { name: 'manual_website', type: 'url', value: a.manual_website || '' })),
    field('Phone', h('input', { name: 'manual_phone', value: a.manual_phone || '', maxlength: 40 }))),
  a.manual_website ? h('p', { class: 'links' }, extLink(a.manual_website, 'Open website')) : null,
  h('div', {}, h('button', { class: 'btn btn-small', type: 'submit' }, 'Save')));
  return form;
}

// ---- Qualification ----------------------------------------------------------
function qualificationForm(a, reload) {
  const stage = select('pipeline_stage', Object.entries(LABELS.stage), a.pipeline_stage);
  const declineWrap = field('Decline reason (required if declined)', h('textarea', { name: 'decline_reason', rows: 2, maxlength: 2000 }, a.decline_reason || ''));
  const syncDecline = () => { declineWrap.hidden = stage.value !== 'declined' && !a.decline_reason; };
  stage.addEventListener('change', syncDecline);
  const errors = h('div');
  const form = h('form', { class: 'card stack', onsubmit: async (e) => {
    e.preventDefault();
    errors.replaceChildren();
    try {
      await api(`/agencies/${a.id}`, { method: 'PATCH', body: formData(form) });
      toast('Saved.');
      reload();
    } catch (err) { errors.append(errorBox(err.message)); }
  } },
  h('h2', {}, 'Qualification'),
  h('div', { class: 'grid-3' },
    field('Pipeline stage', stage),
    field('Handles apartments?', select('handles_apartments', Object.entries(LABELS.apartments), a.handles_apartments)),
    a.source === 'google'
      ? field('Your label (optional)', h('input', { name: 'label', value: a.label || '', maxlength: 120 }), 'Typed by you; shown in lists. Not copied from Google.')
      : h('span')),
  declineWrap,
  h('div', { class: 'grid-2' },
    field('Apartment evidence link', h('input', { name: 'apartment_evidence_url', type: 'url', value: a.apartment_evidence_url || '', placeholder: 'https://…' })),
    field('Evidence note', h('input', { name: 'apartment_evidence_note', value: a.apartment_evidence_note || '', maxlength: 2000 }))),
  h('div', { class: 'grid-3' },
    field('Decision maker', h('input', { name: 'decision_maker_name', value: a.decision_maker_name || '', maxlength: 120 })),
    field('Title', h('input', { name: 'decision_maker_title', value: a.decision_maker_title || '', maxlength: 120 })),
    field('Contact route', h('input', { name: 'contact_route_note', value: a.contact_route_note || '', maxlength: 2000 }), 'e.g. "front desk, ask for Pat"')),
  h('div', { class: 'grid-2' },
    field('Current system', h('textarea', { name: 'current_system', rows: 2, maxlength: 2000 }, a.current_system || '')),
    field('Problem they described', h('textarea', { name: 'problem_described', rows: 2, maxlength: 4000 }, a.problem_described || ''))),
  h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'permission_to_use_sample', checked: Boolean(a.permission_to_use_sample) }),
    ' They gave permission to use a sample of their (non-client) material'),
  field('Notes', h('textarea', { name: 'notes', rows: 4, maxlength: 10000 }, a.notes || '')),
  errors,
  h('div', {}, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Save qualification')));
  syncDecline();
  if (a.apartment_evidence_url) form.querySelector('[name=apartment_evidence_url]').after(h('span', { class: 'hint' }, extLink(a.apartment_evidence_url, 'open evidence')));
  return form;
}

// ---- Calls -------------------------------------------------------------------
function callsSection(a, calls, reload) {
  const errors = h('div');
  const form = h('form', { class: 'stack', onsubmit: async (e) => {
    e.preventDefault();
    errors.replaceChildren();
    const all = formData(form);
    const discovery = {};
    for (const [key] of DISCOVERY_QUESTIONS) { discovery[key] = all[key]; delete all[key]; }
    try {
      await api(`/agencies/${a.id}/calls`, { method: 'POST', body: { ...all, discovery } });
      toast(all.next_action ? 'Call logged and follow-up task created.' : 'Call logged.');
      reload();
    } catch (err) { errors.append(errorBox(err.message)); }
  } },
  h('div', { class: 'grid-3' },
    field('When', h('input', { name: 'contacted_at', type: 'datetime-local', value: nowLocalMinutes(), required: true })),
    field('Channel', select('channel', Object.entries(LABELS.channel), 'call')),
    field('Outcome', select('outcome', Object.entries(LABELS.outcome), 'no_answer'))),
  field('Contact person', h('input', { name: 'contact_person', maxlength: 120 })),
  field('Notes', h('textarea', { name: 'notes', rows: 3, maxlength: 10000 })),
  h('details', { class: 'discovery' }, h('summary', {}, 'Discovery answers (six questions)'),
    DISCOVERY_QUESTIONS.map(([key, label, q]) => field(label, h('textarea', { name: key, rows: 2, maxlength: 4000, placeholder: q })))),
  h('div', { class: 'grid-2' },
    field('Next action', h('input', { name: 'next_action', maxlength: 300 }), 'Creates a follow-up task'),
    field('Next action date', h('input', { name: 'next_action_date', type: 'date', min: todayLocal() }))),
  errors,
  h('div', {}, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Log call')));

  const list = calls.length
    ? h('ul', { class: 'call-list' }, calls.map((c) => h('li', { class: 'call' },
      h('div', { class: 'call-head' },
        h('strong', {}, fmtDateTime(c.contacted_at)), ' · ', LABELS.channel[c.channel], ' · ',
        h('span', { class: `outcome outcome-${c.outcome}` }, LABELS.outcome[c.outcome]),
        c.contact_person ? [' · ', c.contact_person] : '',
        h('button', { class: 'btn-link', type: 'button', onclick: async () => {
          if (!confirm('Delete this call record?')) return;
          try { await api(`/calls/${c.id}`, { method: 'DELETE' }); reload(); } catch (e) { toast(e.message, 'error'); }
        } }, 'delete')),
      c.notes ? h('p', { class: 'pre' }, c.notes) : '',
      DISCOVERY_QUESTIONS.some(([k]) => c[k])
        ? h('dl', { class: 'discovery-answers' }, DISCOVERY_QUESTIONS.filter(([k]) => c[k]).map(([k, label]) => [h('dt', {}, label), h('dd', { class: 'pre' }, c[k])]))
        : '',
      c.next_action ? h('p', { class: 'muted' }, `Next: ${c.next_action}${c.next_action_date ? ` (${c.next_action_date})` : ''}`) : '')))
    : h('p', { class: 'muted' }, 'No calls logged yet.');

  return h('section', { class: 'card' }, h('h2', {}, 'Call log'),
    h('details', { class: 'add-call' }, h('summary', { class: 'btn btn-small' }, '+ Add call'), form), list);
}

// ---- Tasks -------------------------------------------------------------------
function tasksSection(a, tasks, reload) {
  const form = h('form', { class: 'row-form', onsubmit: async (e) => {
    e.preventDefault();
    try { await api('/tasks', { method: 'POST', body: { ...formData(form), agency_id: a.id } }); reload(); } catch (err) { toast(err.message, 'error'); }
  } },
  h('input', { name: 'title', required: true, maxlength: 300, placeholder: 'New task', 'aria-label': 'Task title' }),
  h('input', { name: 'due_date', type: 'date', 'aria-label': 'Due date' }),
  h('button', { class: 'btn btn-small', type: 'submit' }, 'Add task'));
  const today = todayLocal();
  return h('section', { class: 'card' }, h('h2', {}, 'Tasks'), form,
    tasks.length ? h('ul', { class: 'task-list' }, tasks.map((t) => h('li', { class: t.status === 'done' ? 'done' : (t.due_date && t.due_date < today ? 'overdue' : '') },
      h('input', { type: 'checkbox', checked: t.status === 'done', 'aria-label': 'Done', onchange: async (e) => {
        try { await api(`/tasks/${t.id}`, { method: 'PATCH', body: { status: e.target.checked ? 'done' : 'open' } }); reload(); } catch (err) { toast(err.message, 'error'); }
      } }),
      h('span', { class: 'task-date' }, t.due_date || ''),
      h('span', {}, t.title),
      h('button', { class: 'btn-link', type: 'button', onclick: async () => {
        try { await api(`/tasks/${t.id}`, { method: 'DELETE' }); reload(); } catch (err) { toast(err.message, 'error'); }
      } }, 'delete')))) : h('p', { class: 'muted' }, 'No tasks.'));
}

// ---- Demos -------------------------------------------------------------------
function demosSection(a, demos, reload) {
  const form = h('form', { class: 'row-form', onsubmit: async (e) => {
    e.preventDefault();
    try { await api(`/agencies/${a.id}/demos`, { method: 'POST', body: formData(form) }); toast('Demo scheduled.'); reload(); } catch (err) { toast(err.message, 'error'); }
  } },
  h('input', { name: 'scheduled_at', type: 'datetime-local', required: true, 'aria-label': 'Demo date and time' }),
  h('input', { name: 'notes', maxlength: 4000, placeholder: 'Notes (optional)', 'aria-label': 'Demo notes' }),
  h('button', { class: 'btn btn-small', type: 'submit' }, 'Schedule demo'));
  return h('section', { class: 'card' }, h('h2', {}, 'Demos'), form,
    demos.length ? h('ul', { class: 'task-list' }, demos.map((d) => {
      const outcome = h('input', { value: d.outcome || '', maxlength: 2000, placeholder: 'Outcome', 'aria-label': 'Demo outcome' });
      return h('li', {},
        h('span', { class: 'task-date' }, fmtDateTime(d.scheduled_at)),
        h('span', {}, d.notes || ''),
        outcome,
        h('button', { class: 'btn-link', type: 'button', onclick: async () => {
          try { await api(`/demos/${d.id}`, { method: 'PATCH', body: { outcome: outcome.value } }); toast('Saved.'); } catch (err) { toast(err.message, 'error'); }
        } }, 'save'),
        h('button', { class: 'btn-link', type: 'button', onclick: async () => {
          if (!confirm('Delete this demo?')) return;
          try { await api(`/demos/${d.id}`, { method: 'DELETE' }); reload(); } catch (err) { toast(err.message, 'error'); }
        } }, 'delete'));
    })) : h('p', { class: 'muted' }, 'No demos yet.'));
}
