// Add an agency you found yourself. Everything typed here is your own data,
// so Google storage rules do not apply to it.
import { api } from '../api.js';
import { h, field, formData, toast, errorBox } from '../dom.js';

export async function render(root) {
  const errors = h('div');
  const form = h('form', { class: 'card stack', onsubmit: async (e) => {
    e.preventDefault();
    errors.replaceChildren();
    try {
      const r = await api('/agencies/manual', { method: 'POST', body: formData(form) });
      toast('Agency added.');
      location.hash = `#/agency/${r.id}`;
    } catch (err) {
      errors.append(errorBox(err.message));
    }
  } },
  field('Agency name *', h('input', { name: 'manual_name', required: true, maxlength: 200 })),
  field('Website', h('input', { name: 'manual_website', type: 'url', placeholder: 'https://…', maxlength: 2000 })),
  field('Phone', h('input', { name: 'manual_phone', maxlength: 40 })),
  errors,
  h('div', {}, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Add agency')));

  root.append(h('h1', {}, 'Add agency by hand'),
    h('p', { class: 'muted' }, 'For agencies you find yourself (referrals, directories, events). Type the details yourself. Do not copy them from Google Maps; use "Find agencies" for Google listings.'),
    form);
}
