// Find agencies with Google Places Text Search.
// GOOGLE RULE 2: results are shown only; "Save" sends the place ID alone.
// GOOGLE RULE 3: there is deliberately no export/download of results here.
// GOOGLE RULE 4: attribution is shown above and below the results list.
import { api } from '../api.js';
import { h, btn, field, emptyState, extLink, hostOf, googleAttribution, callout } from '../dom.js';
import { icon } from '../icons.js';
import { toast } from '../ui/toast.js';
import { notifyChange } from '../store.js';

export async function render(root, { query }) {
  const relinkId = /^\d+$/.test(query.get('relink') || '') ? query.get('relink') : null;
  const status = await api('/status');

  root.append(h('div', { class: 'page-head' },
    h('div', {}, h('h1', {}, relinkId ? 'Relink to a current listing' : 'Find agencies'),
      h('p', { class: 'lede' }, 'Search Google Places for agencies that handle apartment insurance. Saving stores the place ID only.'))));

  if (!status.googleEnabled) {
    root.append(h('div', { class: 'card' }, h('div', { class: 'card-body stack' },
      callout('info', 'alert', h('strong', {}, 'Google search is off because no API key is set.')),
      h('ol', { class: 'questions' },
        h('li', {}, 'Create a key restricted to "Places API (New)" (README, "Google Cloud setup").'),
        h('li', {}, 'Copy .env.example to .env in the project folder.'),
        h('li', {}, 'Paste the key after GOOGLE_PLACES_API_KEY= in .env. Never paste it into chat or the browser.'),
        h('li', {}, 'Restart the server (Ctrl+C, then npm start).')),
      h('div', { class: 'row' }, h('a', { class: 'btn btn-primary', href: '#/agencies/new' }, icon('plus'), 'Add an agency by hand'), h('a', { class: 'btn', href: '#/agencies' }, 'Try the fake sample agencies')))));
    return;
  }

  if (relinkId) root.append(callout('warn', 'alert', `The saved Google listing for agency #${relinkId} is no longer available. Search again and choose "Use this listing". Your notes and calls stay attached.`));

  const city = h('input', { name: 'city', required: true, maxlength: 100, placeholder: 'e.g. Philadelphia, PA', value: sessionStorage.getItem('hq.city') || '', autocomplete: 'off' });
  const q = h('input', { name: 'query', required: true, maxlength: 150, placeholder: 'e.g. apartment insurance agency', value: sessionStorage.getItem('hq.query') || 'insurance agency apartment', 'data-search': '' });
  const go = h('button', { type: 'submit', class: 'btn btn-primary btn-lg' }, icon('search'), 'Search');
  const results = h('div', { class: 'stack', 'aria-live': 'polite' });
  const form = h('form', { class: 'card card-pad row-end' }, field('City', city), field('What to search', q), go);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!city.value.trim() || !q.value.trim()) return;
    sessionStorage.setItem('hq.city', city.value.trim());
    sessionStorage.setItem('hq.query', q.value.trim());
    go.disabled = true;
    results.replaceChildren(h('div', { class: 'card' }, [1, 2, 3].map(() => h('div', { class: 'finding' }, h('span', { class: 'skeleton skeleton-line', vars: { width: '40%' } }), h('span', { class: 'skeleton skeleton-line', vars: { width: '70%' } })))));
    try {
      const data = await api('/places/search', { method: 'POST', body: { city: city.value.trim(), query: q.value.trim() } });
      showResults(results, data.results, relinkId);
    } catch (err) {
      results.replaceChildren(h('div', { class: 'callout callout-danger', role: 'alert' }, icon('alert'), h('div', {}, err.message)));
    } finally { go.disabled = false; }
  });

  root.append(form, h('p', { class: 'xs subtle', vars: { margin: '8px 0 20px' } }, 'Each search uses 1 Google call (counted in the sidebar). Results are shown, not stored.'), results);
  if (!city.value) city.focus();
}

function showResults(container, places, relinkId) {
  if (!places.length) {
    container.replaceChildren(h('div', { class: 'card' }, emptyState({ iconName: 'search', title: 'No results', text: 'Try a nearby city or different wording, e.g. "commercial property insurance".' })), googleAttribution());
    return;
  }
  const attr = places.flatMap((p) => p.attributions);
  const card = h('section', { class: 'card', 'aria-label': 'Google results' },
    h('div', { class: 'card-head' }, h('span', { class: 'card-eyebrow' }, `${places.length} results from Google`), googleAttribution(attr)));
  for (const p of places) {
    const action = h('button', { type: 'button', class: `btn btn-sm ${relinkId ? 'btn-primary' : ''}` }, icon(relinkId ? 'link' : 'plus', { size: 14 }), relinkId ? 'Use this listing' : 'Save');
    action.addEventListener('click', async () => {
      action.disabled = true;
      try {
        if (relinkId) {
          await api(`/agencies/${relinkId}/place`, { method: 'PUT', body: { place_id: p.id } });
          toast('Agency relinked');
          location.hash = `#/agency/${relinkId}`;
        } else {
          const r = await api('/agencies', { method: 'POST', body: { place_id: p.id } }); // place ID only
          action.replaceWith(h('a', { class: 'btn btn-sm', href: `#/agency/${r.id}` }, icon('check', { size: 14 }), 'Saved · open'));
          toast('Saved (place ID only)');
          notifyChange({ kind: 'save' });
        }
      } catch (err) {
        if (err.status === 409 && err.data && err.data.id) action.replaceWith(h('a', { class: 'btn btn-sm', href: `#/agency/${err.data.id}` }, 'Already saved · open'));
        else { action.disabled = false; toast(err.message, { kind: 'error' }); }
      }
    });
    card.append(h('div', { class: 'finding' },
      h('div', { class: 'row' },
        h('div', { class: 'li-main' },
          h('span', { class: 'finding-label' }, p.name || '(no name)',
            p.businessStatus && p.businessStatus !== 'OPERATIONAL' ? h('span', { class: 'badge badge-warning', vars: { 'margin-left': '8px' } }, p.businessStatus.replace(/_/g, ' ').toLowerCase()) : null),
          h('span', { class: 'small muted' }, p.address || '')),
        action),
      h('div', { class: 'row small' },
        p.website ? extLink(p.website, hostOf(p.website)) : h('span', { class: 'subtle' }, 'No website'),
        p.mapsUrl ? [h('span', { class: 'subtle' }, '·'), extLink(p.mapsUrl, 'View on Google Maps')] : null,
        p.phone ? [h('span', { class: 'subtle' }, '·'), h('span', { class: 'num muted' }, p.phone)] : null)));
  }
  card.append(h('div', { class: 'card-foot' }, googleAttribution(attr)));
  container.replaceChildren(card);
}
