// Toasts with optional action (e.g. Undo). Errors stay longer and are announced.
import { h } from '../dom.js';
import { icon } from '../icons.js';

function region() {
  let r = document.getElementById('toasts');
  if (!r) {
    r = h('div', { id: 'toasts', class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(r);
  }
  return r;
}

export function toast(message, { kind = 'ok', action, duration } = {}) {
  const ms = duration ?? (action ? 6000 : kind === 'error' ? 7000 : 2600);
  const el = h('div', { class: `toast ${kind === 'error' ? 'toast-error' : ''}`, role: kind === 'error' ? 'alert' : null },
    h('span', { class: 'toast-msg' }, message));
  let timer;
  const dismiss = () => {
    clearTimeout(timer);
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 220);
  };
  if (action) {
    el.append(h('button', { type: 'button', onclick: () => { dismiss(); action.onClick(); } }, action.icon ? icon(action.icon, { size: 13 }) : null, action.label));
  }
  el.append(h('button', { type: 'button', class: 'toast-close', 'aria-label': 'Dismiss', onclick: dismiss }, icon('x', { size: 13 })));
  region().append(el);
  timer = setTimeout(dismiss, ms);
  el.addEventListener('mouseenter', () => clearTimeout(timer));
  el.addEventListener('mouseleave', () => { timer = setTimeout(dismiss, 2000); });
  return dismiss;
}

/**
 * Deferred destructive action with Undo: the request is only sent after the
 * undo window closes (or immediately if the page is being left).
 * hideFn() removes the item optimistically; restoreFn() puts it back.
 */
export function withUndo(message, { hideFn, restoreFn, commit, delay = 5000 }) {
  hideFn();
  let done = false;
  const run = async () => {
    if (done) return;
    done = true;
    window.removeEventListener('pagehide', run);
    try { await commit(); } catch (e) { restoreFn(); toast(`Could not complete: ${e.message}`, { kind: 'error' }); }
  };
  const timer = setTimeout(run, delay);
  window.addEventListener('pagehide', run);
  toast(message, {
    duration: delay,
    action: { label: 'Undo', icon: 'undo', onClick: () => { if (done) return; done = true; clearTimeout(timer); window.removeEventListener('pagehide', run); restoreFn(); toast('Restored'); } },
  });
}
