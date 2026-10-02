// App-wide change notifications (a tiny event bus) so open views can refresh
// after an action elsewhere (e.g. a call logged from the quick-log drawer).
export type ChangeDetail = { agencyId?: number; kind?: string };

export function notifyChange(detail: ChangeDetail = {}): void {
  window.dispatchEvent(new CustomEvent<ChangeDetail>("hq:changed", { detail }));
}

export function onChange(fn: (d: ChangeDetail) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent<ChangeDetail>).detail ?? {});
  window.addEventListener("hq:changed", h);
  return () => window.removeEventListener("hq:changed", h);
}

/** Agencies whose delete is waiting out its Undo window (hidden from lists). */
export const pendingDeletes = new Set<number>();
