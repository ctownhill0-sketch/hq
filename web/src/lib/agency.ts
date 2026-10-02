import type { AgencyListItem, Agency } from "./types";

/** Display name from YOUR data only: your label or the name you typed. */
export function agencyName(a: Pick<AgencyListItem, "id" | "label" | "manual_name"> | Pick<Agency, "id" | "label" | "manual_name">): string {
  return a.label || a.manual_name || `Google listing #${a.id}`;
}
