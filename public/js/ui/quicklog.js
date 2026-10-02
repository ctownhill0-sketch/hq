// Quick-log call drawer: available from anywhere (press "l" or use the
// palette). Saves with Cmd/Ctrl+Enter. Logging a next action creates a task.
import { api } from '../api.js';
import { h, field, select, formData, nowLocalMinutes, todayLocal, LABELS, agencyName } from '../dom.js';
import { openDialog } from './dialog.js';
import { toast } from './toast.js';
import { getAgencies, notifyChange } from '../store.js';
import { DISCOVERY_QUESTIONS } from '../views/script.js';

let openNow = null;

export async function openQuickLog({ agencyId = null, channel = 'call' } = {}) {
  if (openNow) return;
  const agencyPick = h('select', { name: 'agency_id', required: true }, h('option', { value: '' }, 'Loading agencies…'));
  const errors = h('div', { role: 'alert' });
  const save = h('button', { type: 'submit', class: 'btn btn-primary', form: 'quicklog-form' }, 'Save call', h('kbd', {}, navigator.platform.includes('Mac') ? '⌘↵' : 'Ctrl ↵'));
  const form = h('form', { id: 'quicklog-form', class: 'stack' },
    field('Agency', agencyPick),
    h('div', { class: 'form-grid' },
      field('When', h('input', { name: 'contacted_at', type: 'datetime-local', value: nowLocalMinutes(), required: true }), null, 'span-6'),
      field('Channel', select('channel', Object.entries(LABELS.channel), channel), null, 'span-6'),
      field('Outcome', select('outcome', Object.entries(LABELS.outcome), channel === 'email' ? 'other' : 'no_answer'), null, 'span-6'),
      field('Contact person', h('input', { name: 'contact_person', maxlength: 120, autocomplete: 'off' }), null, 'span-6')),
    field('Notes', h('textarea', { name: 'notes', rows: 4, maxlength: 10000, placeholder: 'What happened? What did they say?' })),
    h('details', { class: 'disclosure' },
      h('summary', {}, 'Discovery answers (six questions)'),
      h('div', { class: 'stack', vars: { 'margin-top': '12px' } },
        DISCOVERY_QUESTIONS.map(([key, label, q]) => field(label, h('textarea', { name: key, rows: 2, maxlength: 4000, placeholder: q }))))),
    h('div', { class: 'form-grid' },
      field('Next action', h('input', { name: 'next_action', maxlength: 300, placeholder: 'e.g. Send demo invite' }), 'Creates a follow-up task', 'span-8'),
      field('Due', h('input', { name: 'next_action_date', type: 'date', min: todayLocal() }), null, 'span-4')),
    errors);

  async function submit(e) {
    if (e) e.preventDefault();
    errors.replaceChildren();
    const all = formData(form);
    const id = all.agency_id;
    delete all.agency_id;
    if (!id) { errors.append(h('p', { class: 'small overdue-text' }, 'Choose an agency.')); agencyPick.focus(); return; }
    const discovery = {};
    for (const [key] of DISCOVERY_QUESTIONS) { discovery[key] = all[key]; delete all[key]; }
    save.disabled = true;
    try {
      await api(`/agencies/${id}/calls`, { method: 'POST', body: { ...all, discovery } });
      d.close();
      toast(all.next_action ? 'Call logged · follow-up task created' : 'Call logged');
      notifyChange({ agencyId: Number(id), kind: 'call' });
    } catch (err) {
      errors.append(h('div', { class: 'callout callout-danger' }, err.message));
      save.disabled = false;
    }
  }
  form.addEventListener('submit', submit);
  form.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e); });

  const d = openDialog({
    title: channel === 'email' ? 'Log an email' : 'Log a call', variant: 'drawer', body: form,
    footer: [h('span', { class: 'xs subtle spacer' }, 'Nothing is sent: this only records what you did.'), save],
    onClose: () => { openNow = null; },
    initialFocus: agencyId ? form.elements.notes : agencyPick,
  });
  openNow = d;

  try {
    const list = await getAgencies();
    agencyPick.replaceChildren(h('option', { value: '' }, list.length ? 'Choose an agency…' : 'No agencies yet'),
      ...list.slice().sort((a, b) => agencyName(a).localeCompare(agencyName(b))).map((a) => h('option', { value: a.id }, agencyName(a))));
    if (agencyId) agencyPick.value = String(agencyId);
  } catch (e) {
    errors.append(h('div', { class: 'callout callout-danger' }, `Could not load agencies: ${e.message}`));
  }
}
