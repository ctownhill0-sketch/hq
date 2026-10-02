// Minimal hash router (no dependency). Routes look like "#/agency/3?tab=calls".
import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}
const getHash = () => window.location.hash || "#/today";

export function useHash(): { path: string; query: URLSearchParams } {
  const hash = useSyncExternalStore(subscribe, getHash, () => "#/today");
  const [path, q = ""] = hash.slice(1).split("?");
  return { path: path || "/today", query: new URLSearchParams(q) };
}

export function navigate(to: string): void {
  window.location.hash = to.startsWith("#") ? to : `#${to}`;
}

/** Update the query string without creating a history entry or re-routing. */
export function replaceQuery(path: string, params: Record<string, string | null>): void {
  const [, q = ""] = window.location.hash.slice(1).split("?");
  const sp = new URLSearchParams(q);
  for (const [k, v] of Object.entries(params)) { if (v === null) sp.delete(k); else sp.set(k, v); }
  const s = sp.toString();
  history.replaceState(null, "", `#${path}${s ? `?${s}` : ""}`);
}
