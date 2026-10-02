// DOM helpers. All text is set with textContent (never innerHTML), so any
// text from Google, websites, the AI model or your own input is displayed,
// not executed. Dynamic sizes use CSS custom properties via the CSSOM,
// which the strict Content-Security-Policy allows (no inline style attributes).
import { icon } from './icons.js';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'vars') for (const [name, val] of Object.entries(v)) el.style.setProperty(name, val);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'href') { const u = safeUrl(v); if (u) el.setAttribute('href', u); }
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = Boolean(v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of [children].flat(Infinity)) {
    if (c === null || c === undefined || c === false || c === '') continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) { el.replaceChildren(); return el; }

// Only allow http(s) links and in-app hash links.
export function safeUrl(v) {
  if (typeof v !== 'string') return null;
  if (v.startsWith('#/') || v.startsWith('/api/')) return v;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export function extLink(url, text, cls) {
  const u = safeUrl(url);
  if (!u) return h('span', { class: 'muted' }, text || '(invalid link)');
  return h('a', { href: u, target: '_blank', rel: 'noopener noreferrer nofollow', class: cls }, text || u);
}

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

export const LABELS = {
  stage: {
    researched: 'Researched', contacted: 'Contacted', conversation: 'Conversation', demo: 'Demo',
    proposal: 'Proposal', paid_pilot: 'Paid pilot', declined: 'Declined',
  },
  outcome: {
    no_answer: 'No answer', left_message: 'Left message', conversation: 'Conversation',
    meeting_booked: 'Meeting booked', not_interested: 'Not interested', other: 'Other',
  },
  channel: { call: 'Call', email: 'Email', other: 'Other' },
  apartments: { yes: 'Yes', no: 'No', unknown: 'Unknown' },
};
export const STAGE_ORDER = ['researched', 'contacted', 'conversation', 'demo', 'proposal', 'paid_pilot', 'declined'];

export function stageBadge(stage) {
  return h('span', { class: `stage-badge stage-${stage}` }, LABELS.stage[stage] || stage);
}

export function agencyName(a) {
  if (a.label) return a.label;
  if (a.manual_name) return a.manual_name;
  if (a.agency_name) return a.agency_name;
  return `Google listing #${a.id ?? a.agency_id ?? ''}`;
}

export function field(label, input, hint, cls = '') {
  const id = input.id || `f-${Math.random().toString(36).slice(2, 9)}`;
  if (input.tagName && !input.id) input.id = id;
  return h('div', { class: `field ${cls}` },
    h('label', { class: 'field-label', for: id }, label),
    input,
    hint ? h('span', { class: 'field-hint' }, hint) : null);
}

export function select(name, options, value, attrs = {}) {
  const s = h('select', { name, ...attrs }, options.map(([v, text]) => h('option', { value: v }, text)));
  if (value !== undefined && value !== null) s.value = value;
  return s;
}

export function formData(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else out[el.name] = el.value.trim() === '' ? null : el.value;
  }
  return out;
}

export function btn(label, { kind = '', size = '', iconName, onClick, type = 'button', title, attrs = {} } = {}) {
  return h('button', {
    type, class: `btn ${kind ? `btn-${kind}` : ''} ${size ? `btn-${size}` : ''} ${label ? '' : 'btn-icon'}`.trim(),
    onclick: onClick, 'aria-label': label ? null : title, 'data-tip': label ? null : title, ...attrs,
  }, iconName ? icon(iconName, { size: size === 'sm' ? 14 : 16 }) : null, label ? h('span', {}, label) : null);
}

export function callout(kind, iconName, ...children) {
  return h('div', { class: `callout callout-${kind}`, role: kind === 'danger' ? 'alert' : null }, icon(iconName), h('div', {}, ...children));
}

export function errorBox(message, retry) {
  return h('div', { class: 'callout callout-danger', role: 'alert' }, icon('alert'),
    h('div', { class: 'spacer' }, h('strong', {}, 'Something went wrong. '), message),
    retry ? btn('Retry', { size: 'sm', iconName: 'refresh', onClick: retry }) : null);
}

export function emptyState({ iconName = 'sparkles', title, text, actions = [], small = false }) {
  return h('div', { class: `empty ${small ? 'empty-sm' : ''}` },
    h('div', { class: 'empty-icon' }, icon(iconName, { size: 20 })),
    title ? h('h3', {}, title) : null,
    text ? h('p', {}, text) : null,
    actions.length ? h('div', { class: 'row' }, actions) : null);
}

export function skeleton(kind = 'page') {
  if (kind === 'rows') return h('div', { class: 'card card-pad', 'aria-busy': 'true', 'aria-label': 'Loading' }, [1, 2, 3, 4, 5].map((i) => h('span', { class: 'skeleton skeleton-line', vars: { width: `${90 - i * 7}%` } })));
  return h('div', { class: 'stack', 'aria-busy': 'true', 'aria-label': 'Loading' },
    h('span', { class: 'skeleton skeleton-title' }),
    h('div', { class: 'grid grid-4' }, [1, 2, 3, 4].map(() => h('span', { class: 'skeleton skeleton-block' }))),
    h('span', { class: 'skeleton skeleton-block' }));
}

export function todayLocal(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function nowLocalMinutes() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${todayLocal()}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fmtDate(s) {
  if (!s) return '';
  const d = new Date(`${s.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return s;
  const diff = Math.round((d - new Date(`${todayLocal()}T00:00:00`)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

export function fmtDateTime(s) {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return s;
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${fmtDate(s)} · ${time}`;
}

export function money(n, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return '-';
  return `$${Number(n).toFixed(digits)}`;
}

// GOOGLE RULE 4 (see src/google/places.js): "Google Maps" text attribution,
// shown unaltered wherever Google data appears, plus any API attributions.
export function googleAttribution(attributions = []) {
  return h('div', { class: 'gmaps-attribution' },
    h('span', { class: 'gmaps-attr', translate: 'no' }, 'Google Maps'),
    attributions.length
      ? h('span', {}, ' · Data also from: ',
        attributions.map((a, i) => [i ? ', ' : '', a.providerUri ? extLink(a.providerUri, a.provider) : a.provider]))
      : null);
}

export function isTyping(target) {
  const t = target || document.activeElement;
  return Boolean(t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)));
}

export async function copyText(text) {
  const { toast } = await import('./ui/toast.js');
  try { await navigator.clipboard.writeText(text); toast('Copied to clipboard'); } catch { toast('Copy failed: select the text and copy it by hand.', { kind: 'error' }); }
}
