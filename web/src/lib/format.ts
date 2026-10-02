// Date helpers. Dates are stored as local YYYY-MM-DD / YYYY-MM-DDTHH:MM.

const pad = (n: number) => String(n).padStart(2, "0");

export function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function todayLocal(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return toLocalDate(d);
}
export function nowLocalMinutes(): string {
  const d = new Date();
  return `${toLocalDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function parseLocal(s: string): Date {
  return new Date(s.length <= 10 ? `${s}T00:00:00` : s.replace(" ", "T"));
}
export function fmtDate(s: string | null | undefined): string {
  if (!s) return "";
  const d = parseLocal(s.slice(0, 10));
  if (Number.isNaN(d.getTime())) return s;
  const diff = Math.round((d.getTime() - parseLocal(todayLocal()).getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}
export function fmtTime(s: string): string {
  const d = parseLocal(s);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
export function fmtDateTime(s: string | null | undefined): string {
  if (!s) return "";
  return s.length > 10 ? `${fmtDate(s)} · ${fmtTime(s)}` : fmtDate(s);
}
export function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}
/** Only http(s) links are ever rendered as links. */
export function safeHttpUrl(v: string | null | undefined): string | null {
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch { return null; }
}
