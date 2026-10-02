// Modals and drawers on the native <dialog> element: focus trap, Esc to close,
// and focus returns to the element that opened it.
import { h } from '../dom.js';
import { icon } from '../icons.js';

export function openDialog({ title, body, footer, variant = 'modal', label, onClose, initialFocus }) {
  const opener = document.activeElement;
  const closeBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-icon btn-sm', 'aria-label': 'Close' }, icon('x'));
  const panel = h('div', { class: 'modal-panel' },
    title ? h('div', { class: 'modal-head' }, h('h2', { id: `dlg-${Date.now()}` }, title), closeBtn) : null,
    h('div', { class: 'modal-body' }, body),
    footer ? h('div', { class: 'modal-foot' }, footer) : null);
  const dlg = h('dialog', { class: variant, 'aria-label': label || title || 'Dialog' }, panel);
  document.body.append(dlg);

  let closed = false;
  function close(result) {
    if (closed) return;
    closed = true;
    dlg.close();
    dlg.remove();
    if (opener && opener.focus && document.contains(opener)) opener.focus({ preventScroll: true });
    if (onClose) onClose(result);
  }
  closeBtn.addEventListener('click', () => close());
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dlg.addEventListener('mousedown', (e) => { if (e.target === dlg) close(); }); // backdrop click
  dlg.showModal();
  const focusEl = initialFocus || dlg.querySelector('[autofocus], input, select, textarea, button:not(.btn-ghost)');
  if (focusEl) focusEl.focus();
  return { dialog: dlg, close };
}

// Simple confirm with a required text answer (e.g. decline reason).
export function promptDialog({ title, label, placeholder, confirmLabel = 'Save', required = true, multiline = true }) {
  return new Promise((resolve) => {
    const input = h(multiline ? 'textarea' : 'input', { rows: 3, placeholder, maxlength: 2000, 'aria-label': label });
    const error = h('p', { class: 'small', role: 'alert' });
    const confirm = h('button', { type: 'submit', class: 'btn btn-primary' }, confirmLabel);
    const cancel = h('button', { type: 'button', class: 'btn' }, 'Cancel');
    let value = null;
    const form = h('form', { class: 'stack', onsubmit: (e) => {
      e.preventDefault();
      if (required && !input.value.trim()) { error.textContent = 'This is required.'; input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
      value = input.value.trim();
      d.close(value);
    } }, h('label', { class: 'field-label' }, label), input, error, h('div', { class: 'row' }, h('span', { class: 'spacer' }), cancel, confirm));
    const d = openDialog({ title, body: form, onClose: () => resolve(value), initialFocus: input });
    cancel.addEventListener('click', () => d.close());
  });
}
