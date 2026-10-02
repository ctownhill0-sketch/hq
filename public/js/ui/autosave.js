// Inline editing with autosave. Saves a field 600ms after you stop typing
// (or immediately on change/blur), shows Saving… / Saved / Not saved.
import { h } from '../dom.js';

export function saveIndicator() {
  const el = h('span', { class: 'save-state', role: 'status', 'aria-live': 'polite' });
  let t;
  return {
    el,
    set(state, text) {
      clearTimeout(t);
      el.className = `save-state ${state}`;
      el.textContent = text ?? ({ saving: 'Saving…', saved: 'Saved', error: 'Not saved' }[state] || '');
      if (state === 'saved') t = setTimeout(() => { el.textContent = ''; el.className = 'save-state'; }, 2200);
    },
  };
}

/**
 * bindAutosave(inputs, save, indicator)
 * save(patch) -> Promise. On failure the field is marked and the error shown;
 * the typed value is kept so nothing is lost.
 */
export function bindAutosave(inputs, save, indicator) {
  const timers = new Map();
  const lastSaved = new Map();
  const valueOf = (el) => (el.type === 'checkbox' ? el.checked : (el.value.trim() === '' ? null : el.value));
  for (const el of inputs) lastSaved.set(el, valueOf(el));

  async function flush(el) {
    clearTimeout(timers.get(el));
    const v = valueOf(el);
    if (v === lastSaved.get(el)) return;
    indicator.set('saving');
    try {
      await save({ [el.name]: v }, el);
      lastSaved.set(el, v);
      el.removeAttribute('aria-invalid');
      indicator.set('saved');
    } catch (e) {
      el.setAttribute('aria-invalid', 'true');
      indicator.set('error', `Not saved: ${e.message}`);
    }
  }
  for (const el of inputs) {
    const isText = el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['checkbox', 'date', 'datetime-local'].includes(el.type));
    if (isText) {
      el.addEventListener('input', () => { clearTimeout(timers.get(el)); timers.set(el, setTimeout(() => flush(el), 600)); });
      el.addEventListener('blur', () => flush(el));
    } else {
      el.addEventListener('change', () => flush(el));
    }
  }
  return { flushAll: () => Promise.all(inputs.map(flush)), markSaved: (el) => lastSaved.set(el, valueOf(el)) };
}
