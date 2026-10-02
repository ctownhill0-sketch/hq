// Small shared cache for the agencies list (used by the command palette and
// the quick-log drawer) plus app-wide change notifications.
import { api } from './api.js';

let agencies = null;
let pending = null;

export async function getAgencies({ fresh = false } = {}) {
  if (agencies && !fresh) return agencies;
  if (!pending) pending = api('/agencies').then((r) => { agencies = r.agencies; return agencies; }).finally(() => { pending = null; });
  return pending;
}

export function invalidateAgencies() { agencies = null; }

// Tell open views something changed (they decide whether to refresh).
export function notifyChange(detail = {}) {
  invalidateAgencies();
  window.dispatchEvent(new CustomEvent('hq:changed', { detail }));
}

// Agencies whose delete is waiting out its Undo window (hidden from lists).
export const pendingDeletes = new Set();
