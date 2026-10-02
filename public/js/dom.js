// DOM helpers. All text is set with textContent (never innerHTML), so any
// text from Google, websites or your own input is displayed, not executed.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'href') { const u = safeUrl(v); if (u) el.setAttribute('href', u); }
    else if (k === 'value') el.value = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

// Only allow http(s) links and same-page hash links.
export function safeUrl(v) {
  if (typeof v !== 'string') return null;
  if (v.startsWith('#/')) return v;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

// External link that opens in a new tab without giving the page access to us.
export function extLink(url, text) {
  const u = safeUrl(url);
  if (!u) return h('span', { class: 'muted' }, text || '(invalid link)');
  return h('a', { href: u, target: '_blank', rel: 'noopener noreferrer nofollow' }, text || u);
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

// Visible error box. Errors are never silent.
export function errorBox(message, retry) {
  return h('div', { class: 'alert alert-error', role: 'alert' },
    h('strong', {}, 'Error: '), message,
    retry ? h('button', { class: 'btn btn-small', type: 'button', onclick: retry }, 'Retry') : null);
}

export function notice(message, kind = 'info') {
  return h('div', { class: `alert alert-${kind}` }, message);
}

let toastTimer;
export function toast(message, kind = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast toast-${kind} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, kind === 'error' ? 6000 : 2500);
}

// Read a form into a plain object (empty strings become null).
export function formData(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else out[el.name] = el.value.trim() === '' ? null : el.value;
  }
  return out;
}

export function field(label, input, hint) {
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), input,
    hint ? h('span', { class: 'hint' }, hint) : null);
}

export function select(name, options, value) {
  return h('select', { name }, options.map(([v, text]) => {
    const o = h('option', { value: v }, text);
    if (v === value) o.selected = true;
    return o;
  }));
}

export function todayLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function nowLocalMinutes() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${todayLocal()}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fmtDateTime(s) { return s ? s.replace('T', ' ') : ''; }

// GOOGLE RULE 4 (see src/google/places.js): "Google Maps" text attribution,
// shown unaltered wherever Google data appears, plus any API attributions.
export function googleAttribution(attributions = []) {
  return h('div', { class: 'gmaps-attribution' },
    h('span', { class: 'gmaps-attr', translate: 'no' }, 'Google Maps'),
    attributions.length
      ? h('span', { class: 'gmaps-extra' }, ' · Data also from: ',
        attributions.map((a, i) => [i ? ', ' : '', a.providerUri ? extLink(a.providerUri, a.provider) : a.provider]))
      : null);
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

export function agencyName(a) {
  if (a.label) return a.label;
  if (a.manual_name) return a.manual_name;
  return `Google listing #${a.id ?? a.agency_id ?? ''}`;
}
