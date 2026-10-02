// Add an agency you found yourself. Everything typed here is your own data,
// so Google storage rules do not apply to it.
import { api } from '../api.js';
import { h, field, formData, callout } from '../dom.js';
import { icon } from '../icons.js';
import { toast } from '../ui/toast.js';
import { notifyChange } from '../store.js';

export async function render(root) {
  const errors = h('div', { role: 'alert' });
  const name = h('input', { name: 'manual_name', required: true, maxlength: 200, autocomplete: 'off', placeholder: 'e.g. Keystone Property Insurance' });
  const form = h('form', { class: 'card' },
    h('div', { class: 'card-body form-grid' },
      field('Agency name', name, null, 'span-12'),
      field('Website', h('input', { name: 'manual_website', type: 'url', placeholder: 'https://…', maxlength: 2000 }), 'Used later to prefill Deep Research.', 'span-6'),
      field('Phone', h('input', { name: 'manual_phone', type: 'tel', maxlength: 40 }), null, 'span-6'),
      h('div', { class: 'span-12' }, errors)),
    h('div', { class: 'card-foot row' }, h('span', { class: 'xs subtle spacer' }, 'Saves to your local database only.'),
      h('a', { class: 'btn', href: '#/agencies' }, 'Cancel'),
      h('button', { class: 'btn btn-primary', type: 'submit' }, icon('plus'), 'Add agency')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errors.replaceChildren();
    try {
      const r = await api('/agencies/manual', { method: 'POST', body: formData(form) });
      toast('Agency added');
      notifyChange({ kind: 'create' });
      location.hash = `#/agency/${r.id}`;
    } catch (err) {
      errors.append(callout('danger', 'alert', err.message));
    }
  });
  root.append(
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Add an agency by hand'),
      h('p', { class: 'lede' }, 'For agencies you found yourself: referrals, directories, events.'))),
    h('div', { class: 'stack', vars: { 'max-width': '720px' } },
      callout('info', 'alert', 'Type the details yourself. Do not copy them from Google Maps; use Find agencies for Google listings.'),
      form));
  setTimeout(() => name.focus(), 0);
}
