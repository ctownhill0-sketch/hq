// Command palette (Cmd/Ctrl+K): jump to any agency or page, or run an action.
import { h, agencyName, LABELS } from '../dom.js';
import { icon } from '../icons.js';
import { openDialog } from './dialog.js';
import { getAgencies } from '../store.js';

let open = false;

// Subsequence fuzzy score: higher is better, -1 = no match.
function score(text, q) {
  if (!q) return 0;
  const t = text.toLowerCase();
  const i = t.indexOf(q);
  if (i >= 0) return 100 - i;
  let ti = 0, s = 0;
  for (const ch of q) {
    const f = t.indexOf(ch, ti);
    if (f < 0) return -1;
    s += f === ti ? 2 : 1;
    ti = f + 1;
  }
  return s;
}

export async function openPalette({ commands }) {
  if (open) return;
  open = true;
  const input = h('input', { type: 'text', placeholder: 'Type a command or search agencies…', 'aria-label': 'Command', autocomplete: 'off', spellcheck: 'false', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'palette-list' });
  const list = h('ul', { class: 'palette-list', id: 'palette-list', role: 'listbox' });
  const panel = h('div', {},
    h('div', { class: 'palette-input' }, icon('search', { size: 18 }), input, h('kbd', {}, 'esc')),
    list,
    h('div', { class: 'palette-foot' },
      h('span', {}, h('kbd', {}, '↑'), h('kbd', {}, '↓'), 'navigate'),
      h('span', {}, h('kbd', {}, '↵'), 'open'),
      h('span', {}, h('kbd', {}, '?'), 'all shortcuts')));
  const d = openDialog({ body: panel, variant: 'palette', label: 'Command palette', onClose: () => { open = false; }, initialFocus: input });

  let agencies = [];
  let items = [];
  let active = 0;

  function render() {
    const q = input.value.trim().toLowerCase();
    const cmd = commands.map((c) => ({ ...c, group: 'Actions', s: score(`${c.label} ${c.keywords || ''}`, q) })).filter((c) => c.s >= 0);
    const ag = agencies.map((a) => ({
      label: agencyName(a), icon: 'building', group: 'Agencies', hint: LABELS.stage[a.pipeline_stage],
      run: () => { location.hash = `#/agency/${a.id}`; }, s: score(`${agencyName(a)} ${a.decision_maker_name || ''}`, q),
    })).filter((a) => a.s >= 0);
    items = [...cmd.sort((a, b) => b.s - a.s), ...ag.sort((a, b) => b.s - a.s).slice(0, q ? 20 : 6)];
    active = Math.min(active, Math.max(items.length - 1, 0));
    list.replaceChildren();
    if (!items.length) { list.append(h('li', { class: 'palette-empty' }, 'No matches.')); return; }
    let group = null;
    items.forEach((it, i) => {
      if (it.group !== group) { group = it.group; list.append(h('li', { class: 'palette-group', role: 'presentation' }, group)); }
      const li = h('li', { class: 'palette-item', role: 'option', id: `pal-${i}`, 'aria-selected': String(i === active),
        onmousemove: () => { if (active !== i) { active = i; sync(); } }, onclick: () => choose(i) },
      icon(it.icon || 'command'), h('span', {}, it.label),
      it.shortcut ? h('span', { class: 'hint' }, it.shortcut.map((k) => h('kbd', {}, k))) : it.hint ? h('span', { class: 'hint' }, it.hint) : null);
      list.append(li);
    });
    sync();
  }
  function sync() {
    list.querySelectorAll('.palette-item').forEach((el) => el.setAttribute('aria-selected', String(el.id === `pal-${active}`)));
    const el = list.querySelector(`#pal-${active}`);
    if (el) { el.scrollIntoView({ block: 'nearest' }); input.setAttribute('aria-activedescendant', el.id); }
  }
  function choose(i) {
    const it = items[i];
    if (!it) return;
    d.close();
    setTimeout(() => it.run(), 0);
  }
  input.addEventListener('input', () => { active = 0; render(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % Math.max(items.length, 1); sync(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + items.length) % Math.max(items.length, 1); sync(); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
  });
  render();
  try { agencies = await getAgencies(); render(); } catch { /* palette still works for actions */ }
}
