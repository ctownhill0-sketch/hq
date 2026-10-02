// Global keyboard shortcuts and the "?" help overlay.
import { h, isTyping } from '../dom.js';
import { openDialog } from './dialog.js';

export const SHORTCUTS = [
  [['⌘/Ctrl', 'K'], 'Command palette'],
  [['g', 't'], 'Go to Today'],
  [['g', 'a'], 'Go to Agencies'],
  [['g', 'f'], 'Find agencies on Google'],
  [['n'], 'New agency (by hand)'],
  [['l'], 'Log a call'],
  [['/'], 'Focus search'],
  [['['], 'Collapse / expand sidebar'],
  [['j', 'k'], 'Move down / up in lists'],
  [['↵'], 'Open selected row'],
  [['⌘/Ctrl', '↵'], 'Save the open form'],
  [['?'], 'Show this help'],
  [['esc'], 'Close dialog'],
];

let helpOpen = false;
export function showHelp() {
  if (helpOpen) return;
  helpOpen = true;
  openDialog({
    title: 'Keyboard shortcuts',
    body: h('div', { class: 'shortcut-list' }, SHORTCUTS.map(([keys, label]) => [
      h('span', {}, label), h('span', { class: 'keys' }, keys.map((k) => h('kbd', {}, k)))])),
    onClose: () => { helpOpen = false; },
  });
}

export function installShortcuts(actions) {
  let pendingG = 0;
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); actions.palette(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    if (isTyping(e.target)) return;
    const k = e.key;
    if (pendingG && Date.now() - pendingG < 1200) {
      pendingG = 0;
      if (k === 't') { e.preventDefault(); location.hash = '#/today'; }
      else if (k === 'a') { e.preventDefault(); location.hash = '#/agencies'; }
      else if (k === 'f') { e.preventDefault(); location.hash = '#/search'; }
      return;
    }
    if (k === 'g') { pendingG = Date.now(); return; }
    if (k === '?') { e.preventDefault(); showHelp(); }
    else if (k === 'n') { e.preventDefault(); location.hash = '#/agencies/new'; }
    else if (k === 'l') { e.preventDefault(); actions.logCall(); }
    else if (k === '[') { e.preventDefault(); actions.toggleSidebar(); }
    else if (k === '/') {
      const s = document.querySelector('[data-search]');
      e.preventDefault();
      if (s) s.focus();
      else { sessionStorage.setItem('hq.focusSearch', '1'); location.hash = '#/agencies'; }
    }
  });
}
