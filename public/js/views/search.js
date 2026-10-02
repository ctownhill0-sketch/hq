// Find agencies with Google Places Text Search.
// GOOGLE RULE 2: results are shown only; "Save" sends the place ID alone.
// GOOGLE RULE 3: there is deliberately no export/download of results here.
// GOOGLE RULE 4: attribution is shown above and below the results list.
import { api } from '../api.js';
import { h, clear, errorBox, notice, extLink, field, toast, googleAttribution } from '../dom.js';

export async function render(root, { query }) {
  const relinkId = /^\d+$/.test(query.get('relink') || '') ? query.get('relink') : null;
  root.append(h('h1', {}, relinkId ? 'Relink agency to a current listing' : 'Find agencies'));

  const status = await api('/status');
  if (!status.googleEnabled) {
    root.append(
      notice('Google search is off because no API key is set.', 'warn'),
      h('ol', { class: 'steps' },
        h('li', {}, 'Create a key restricted to "Places API (New)" (README → "Google Cloud setup").'),
        h('li', {}, 'Copy .env.example to .env in the project folder.'),
        h('li', {}, 'Paste the key after GOOGLE_PLACES_API_KEY= in .env (never into chat or the browser).'),
        h('li', {}, 'Restart the server (Ctrl+C, then npm start).')),
      h('p', {}, 'You can still ', h('a', { href: '#/agencies/new' }, 'add agencies by hand'),
        ' and try the fake sample agencies on the ', h('a', { href: '#/agencies' }, 'Agencies'), ' page.'));
    return;
  }

  if (relinkId) {
    root.append(notice(`The saved Google listing for agency #${relinkId} is no longer available. Search for it again and choose "Use this listing". Your notes and calls stay attached.`, 'warn'));
  }

  const results = h('div', { class: 'results' });
  const cityInput = h('input', { name: 'city', required: true, maxlength: 100, placeholder: 'e.g. Philadelphia, PA', value: sessionStorage.getItem('hq.city') || '' });
  const queryInput = h('input', { name: 'query', required: true, maxlength: 150, placeholder: 'e.g. apartment insurance agency', value: sessionStorage.getItem('hq.query') || 'insurance agency apartment' });
  const button = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Search');

  const form = h('form', { class: 'row-form', onsubmit: async (e) => {
    e.preventDefault();
    const city = cityInput.value.trim();
    const q = queryInput.value.trim();
    if (!city || !q) return;
    sessionStorage.setItem('hq.city', city);
    sessionStorage.setItem('hq.query', q);
    button.disabled = true;
    clear(results).append(h('p', { class: 'muted' }, 'Searching Google Places…'));
    try {
      const data = await api('/places/search', { method: 'POST', body: { city, query: q } });
      showResults(results, data.results, relinkId);
    } catch (err) {
      clear(results).append(errorBox(err.message));
    } finally {
      button.disabled = false;
    }
  } },
  field('City', cityInput), field('What to search', queryInput), button);

  root.append(form,
    h('p', { class: 'hint' }, 'Each search uses 1 Google call. Results are shown only; saving stores the place ID, not the details.'),
    results);
}

function showResults(container, places, relinkId) {
  clear(container);
  if (!places.length) {
    container.append(notice('No results. Try a different city or wording.'), googleAttribution());
    return;
  }
  const allAttr = places.flatMap((p) => p.attributions);
  container.append(googleAttribution(allAttr));
  const list = h('ul', { class: 'result-list' });
  for (const p of places) {
    const btn = h('button', { class: 'btn btn-small', type: 'button' }, relinkId ? 'Use this listing' : 'Save');
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        if (relinkId) {
          await api(`/agencies/${relinkId}/place`, { method: 'PUT', body: { place_id: p.id } });
          toast('Agency relinked.');
          location.hash = `#/agency/${relinkId}`;
        } else {
          const r = await api('/agencies', { method: 'POST', body: { place_id: p.id } }); // place ID only
          btn.textContent = 'Saved';
          toast('Saved (place ID only).');
          btn.after(' ', h('a', { href: `#/agency/${r.id}`, class: 'small' }, 'Open'));
        }
      } catch (err) {
        if (err.status === 409 && err.data && err.data.id) {
          btn.textContent = 'Already saved';
          btn.after(' ', h('a', { href: `#/agency/${err.data.id}`, class: 'small' }, 'Open'));
        } else {
          btn.disabled = false;
          toast(err.message, 'error');
        }
      }
    });
    list.append(h('li', { class: 'result' },
      h('div', { class: 'result-main' },
        h('div', { class: 'result-name' }, p.name || '(no name)'),
        p.businessStatus && p.businessStatus !== 'OPERATIONAL' ? h('span', { class: 'tag tag-warn' }, p.businessStatus) : null,
        h('div', { class: 'muted' }, p.address || ''),
        h('div', { class: 'links' },
          p.website ? extLink(p.website, 'Website') : h('span', { class: 'muted' }, 'No website'),
          ' · ', p.mapsUrl ? extLink(p.mapsUrl, 'View on Google Maps') : null,
          p.phone ? [' · ', p.phone] : null)),
      h('div', { class: 'result-actions' }, btn)));
  }
  container.append(list, googleAttribution(allAttr));
}
