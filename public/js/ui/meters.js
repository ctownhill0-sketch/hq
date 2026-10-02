// Daily usage meters (Google calls, research runs, research spend).
import { h, money } from '../dom.js';

function meter(label, used, cap, fmt = (n) => String(n)) {
  const pct = cap ? Math.min(100, (used / cap) * 100) : 0;
  return h('div', { class: `meter ${pct >= 100 ? 'full' : pct >= 80 ? 'warn' : ''}` },
    h('div', { class: 'meter-label' }, h('span', {}, label), h('strong', {}, `${fmt(used)} / ${fmt(cap)}`)),
    h('div', { class: 'meter-track', role: 'progressbar', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': cap, 'aria-valuenow': used },
      h('div', { class: 'meter-fill', vars: { '--w': `${pct}%` } })));
}

export function renderMeters(el, { google, research }) {
  const parts = [];
  if (google) parts.push(google.enabled === false
    ? h('div', { class: 'meter-off' }, 'Google search off (no key)')
    : meter('Google calls today', google.usedToday, google.perDay));
  if (research) {
    if (research.enabled) {
      parts.push(meter('Research runs', research.runsToday, research.runsPerDay));
      parts.push(meter('Research spend', research.spendTodayUsd, research.dailySpendCapUsd, (n) => money(n)));
    } else parts.push(h('div', { class: 'meter-off' }, 'Deep Research off (see Research tab)'));
  }
  el.replaceChildren(...parts);
}
