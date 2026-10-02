// App shell: sidebar, theme, meters, router, palette, shortcuts.
import { api } from './api.js';
import { h, clear, errorBox, skeleton } from './dom.js';
import { icon } from './icons.js';
import { renderMeters } from './ui/meters.js';
import { installShortcuts, showHelp } from './ui/shortcuts.js';
import { openPalette } from './ui/palette.js';
import { openQuickLog } from './ui/quicklog.js';
import * as today from './views/today.js';
import * as agencies from './views/agencies.js';
import * as agency from './views/agency.js';
import * as manual from './views/manual.js';
import * as search from './views/search.js';

const NAV = [
  { group: 'Sales' },
  { id: 'today', label: 'Today', icon: 'today', href: '#/today', keys: 'G T' },
  { id: 'agencies', label: 'Agencies', icon: 'building', href: '#/agencies', keys: 'G A' },
  { id: 'search', label: 'Find agencies', icon: 'search', href: '#/search', keys: 'G F' },
  { id: 'new', label: 'Add by hand', icon: 'plus', href: '#/agencies/new', keys: 'N' },
  { group: 'Coming next' },
  { label: 'Pipeline', icon: 'pipeline', soon: 'Stage 2' },
  { label: 'Scorecard', icon: 'chart', soon: 'Stage 2' },
  { label: 'Objections', icon: 'message', soon: 'Stage 2' },
  { label: 'Operators', icon: 'users', soon: 'Stage 3' },
  { label: 'Licensing', icon: 'award', soon: 'Stage 3' },
  { label: 'Gates', icon: 'flag', soon: 'Stage 3' },
  { label: 'Ledger', icon: 'wallet', soon: 'Stage 4' },
  { label: 'Renewal demo', icon: 'clipboard', soon: 'Stage 5' },
];

const routes = [
  [/^#\/today$/, today, 'today'],
  [/^#\/agencies$/, agencies, 'agencies'],
  [/^#\/agencies\/new$/, manual, 'new'],
  [/^#\/agency\/(\d+)$/, agency, 'agencies'],
  [/^#\/search$/, search, 'search'],
];

const view = document.getElementById('view');
const root = document.documentElement;

// ---------- Sidebar ----------
function buildNav() {
  const nav = document.getElementById('nav');
  nav.replaceChildren(...NAV.map((n) => {
    if (n.group) return h('div', { class: 'nav-group' }, n.group);
    if (n.soon) {
      return h('span', { class: 'nav-item', 'aria-disabled': 'true', 'data-tip': `${n.label}: coming next (${n.soon})`, 'data-tip-pos': 'right', tabindex: '-1' },
        icon(n.icon), h('span', {}, n.label), h('span', { class: 'soon' }, n.soon));
    }
    return h('a', { class: 'nav-item', href: n.href, dataset: { nav: n.id }, 'data-tip': n.label, 'data-tip-pos': 'right' },
      icon(n.icon), h('span', {}, n.label));
  }));
}

const THEMES = ['system', 'light', 'dark'];
const THEME_ICON = { system: 'monitor', light: 'sun', dark: 'moon' };
function currentTheme() {
  try { return localStorage.getItem('hq.theme') || 'system'; } catch { return 'system'; }
}
function applyTheme(t) {
  if (t === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
  try { localStorage.setItem('hq.theme', t); } catch { /* ignore */ }
}

function toggleSidebar() {
  const collapsed = root.classList.toggle('sidebar-collapsed');
  try { localStorage.setItem('hq.sidebar', collapsed ? 'collapsed' : 'open'); } catch { /* ignore */ }
  syncCollapseBtn();
}
function syncCollapseBtn() {
  const b = document.getElementById('collapse-btn');
  const collapsed = root.classList.contains('sidebar-collapsed');
  b.replaceChildren(icon(collapsed ? 'chevronRight' : 'sidebar'));
  b.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
  b.setAttribute('aria-expanded', String(!collapsed));
}

function buildActions() {
  const themeBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-icon btn-sm' });
  const syncTheme = () => {
    const t = currentTheme();
    themeBtn.replaceChildren(icon(THEME_ICON[t]));
    themeBtn.setAttribute('aria-label', `Theme: ${t}. Click to change.`);
    themeBtn.setAttribute('data-tip', `Theme: ${t}`);
  };
  themeBtn.addEventListener('click', () => { applyTheme(THEMES[(THEMES.indexOf(currentTheme()) + 1) % 3]); syncTheme(); });
  syncTheme();
  document.getElementById('sidebar-actions').replaceChildren(
    themeBtn,
    h('button', { type: 'button', class: 'btn btn-ghost btn-icon btn-sm', 'aria-label': 'Keyboard shortcuts', 'data-tip': 'Shortcuts  ?', onclick: showHelp }, icon('keyboard')),
    h('button', { type: 'button', class: 'btn btn-ghost btn-icon btn-sm', 'aria-label': 'Command palette', 'data-tip': 'Command palette', onclick: palette }, icon('command')),
    h('a', { class: 'btn btn-ghost btn-icon btn-sm sidebar-export', href: '/api/export/my-data.json', download: true, 'aria-label': 'Export my notes (JSON)', 'data-tip': 'Export my notes (JSON)' }, icon('download')));
  document.getElementById('collapse-btn').addEventListener('click', toggleSidebar);
  syncCollapseBtn();
}

// ---------- Meters ----------
const usage = { google: null, research: null };
function drawMeters() { renderMeters(document.getElementById('meters'), usage); }
async function loadUsage() {
  try {
    const [g, r] = await Promise.all([api('/status'), api('/research/status')]);
    usage.google = { ...g.usage, enabled: g.googleEnabled };
    usage.research = r.research;
    drawMeters();
  } catch { document.getElementById('meters').replaceChildren(h('div', { class: 'meter-off' }, 'Usage unavailable')); }
}
window.addEventListener('hq:usage', (e) => { usage.google = { ...(usage.google || {}), ...e.detail }; drawMeters(); });
window.addEventListener('hq:research-usage', (e) => { usage.research = e.detail; drawMeters(); });

// ---------- Palette ----------
function palette() {
  const agencyMatch = location.hash.match(/^#\/agency\/(\d+)/);
  openPalette({
    commands: [
      { label: 'Log a call', icon: 'phone', shortcut: ['L'], keywords: 'call record', run: () => openQuickLog({ agencyId: agencyMatch ? agencyMatch[1] : null }) },
      { label: 'Log an email', icon: 'mail', keywords: 'email record', run: () => openQuickLog({ agencyId: agencyMatch ? agencyMatch[1] : null, channel: 'email' }) },
      { label: 'Add task', icon: 'task', keywords: 'todo follow up', run: () => { location.hash = agencyMatch ? `#/agency/${agencyMatch[1]}?tab=tasks&new=1` : '#/today?newtask=1'; } },
      { label: 'New agency (by hand)', icon: 'plus', shortcut: ['N'], keywords: 'add create', run: () => { location.hash = '#/agencies/new'; } },
      { label: 'Search Google for agencies', icon: 'search', shortcut: ['G', 'F'], keywords: 'find places', run: () => { location.hash = '#/search'; } },
      ...(agencyMatch ? [{ label: 'Research this agency', icon: 'sparkles', keywords: 'deep ai', run: () => { location.hash = `#/agency/${agencyMatch[1]}?tab=research`; } }] : []),
      { label: 'Go to Today', icon: 'today', shortcut: ['G', 'T'], run: () => { location.hash = '#/today'; } },
      { label: 'Go to Agencies', icon: 'building', shortcut: ['G', 'A'], run: () => { location.hash = '#/agencies'; } },
      { label: 'Toggle theme', icon: 'moon', keywords: 'dark light', run: () => { applyTheme(THEMES[(THEMES.indexOf(currentTheme()) + 1) % 3]); buildActions(); } },
      { label: 'Keyboard shortcuts', icon: 'keyboard', shortcut: ['?'], run: showHelp },
    ],
  });
}

// ---------- Router ----------
let renderToken = 0;
let lastPath = null;
async function route() {
  const [hashPath, query = ''] = (location.hash || '#/today').split('?');
  if (hashPath === '#/followups' || hashPath === '' || hashPath === '#/') { location.replace('#/today'); return; }
  const match = routes.find(([re]) => re.test(hashPath));
  if (!match) { location.replace('#/today'); return; }
  const [re, mod, nav] = match;
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const on = a.dataset.nav === nav;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  const token = ++renderToken;
  // Same page re-rendering (after a save): keep current content until the
  // new content is ready, so nothing flickers or shifts. New page: skeleton.
  const samePage = hashPath === lastPath && view.firstElementChild;
  lastPath = hashPath;
  let page;
  if (samePage) page = view.firstElementChild;
  else {
    page = h('div', { class: 'page view-enter' });
    page.append(skeleton());
    clear(view).append(page);
  }
  const params = { match: hashPath.match(re), query: new URLSearchParams(query), isCurrent: () => token === renderToken };
  try {
    const content = h('div');
    await mod.render(content, params);
    if (token !== renderToken) return;
    page.replaceChildren(...content.childNodes);
  } catch (e) {
    if (token !== renderToken) return;
    page.replaceChildren(errorBox(e.message, route));
  }
  if (!samePage && (!view.contains(document.activeElement) || document.activeElement === document.body)) view.focus({ preventScroll: true });
  document.title = `${(page.querySelector('h1') || {}).textContent || 'HQ Desk'} · HQ Desk`;
}

buildNav();
buildActions();
installShortcuts({ palette, logCall: () => { const m = location.hash.match(/^#\/agency\/(\d+)/); openQuickLog({ agencyId: m ? m[1] : null }); }, toggleSidebar });
window.addEventListener('hashchange', route);
window.addEventListener('hq:changed', () => loadUsage());
loadUsage();
route();
