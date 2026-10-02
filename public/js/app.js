// Tiny hash router. Each view exports render(container, params).
import { api } from './api.js';
import { clear, errorBox } from './dom.js';
import * as search from './views/search.js';
import * as agencies from './views/agencies.js';
import * as agency from './views/agency.js';
import * as manual from './views/manual.js';
import * as followups from './views/followups.js';

const routes = [
  [/^#\/search$/, search, 'search'],
  [/^#\/agencies$/, agencies, 'agencies'],
  [/^#\/agencies\/new$/, manual, 'new'],
  [/^#\/agency\/(\d+)$/, agency, 'agencies'],
  [/^#\/followups$/, followups, 'followups'],
];

const view = document.getElementById('view');

async function route() {
  const [hashPath, query = ''] = (location.hash || '#/followups').split('?');
  const match = routes.find(([re]) => re.test(hashPath));
  if (!match) { location.hash = '#/followups'; return; }
  const [re, mod, nav] = match;
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === nav));
  const params = { match: hashPath.match(re), query: new URLSearchParams(query) };
  clear(view);
  try {
    await mod.render(view, params);
  } catch (e) {
    clear(view).append(errorBox(e.message, route));
  }
  view.focus({ preventScroll: true });
}

function showUsage(u) {
  const el = document.getElementById('usage');
  el.textContent = `Google calls today: ${u.usedToday} / ${u.perDay}`;
  el.classList.toggle('usage-warn', u.usedToday >= u.perDay * 0.8);
}
window.addEventListener('hq:usage', (e) => showUsage(e.detail));
window.addEventListener('hashchange', route);

api('/status').then((s) => showUsage(s.usage)).catch(() => {
  document.getElementById('usage').textContent = 'Google calls: unavailable';
});
route();
