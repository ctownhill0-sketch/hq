import { ChevronLeftIcon, ChevronRightIcon, ListChecksIcon, PresentationIcon } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { parseLocal, toLocalDate, todayLocal } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface CalEvent { id: string; date: string; label: string; kind: "demo" | "task"; done?: boolean; time?: string }

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Small accessible month calendar (own implementation; see README for why the
 * ReUI Event Calendar was not used). Keyboard: arrows move by day/week,
 * PageUp/PageDown change month, Home/End jump to week start/end, Enter selects.
 */
export function MonthCalendar({ month, onMonthChange, events, selected, onSelect }: {
  month: string; // YYYY-MM
  onMonthChange: (m: string) => void;
  events: CalEvent[];
  selected: string; // YYYY-MM-DD
  onSelect: (d: string) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const today = todayLocal();
  const first = parseLocal(`${month}-01`);
  const label = first.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const days = useMemo(() => {
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7)); // back to Monday
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return toLocalDate(d); });
  }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of events) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return m;
  }, [events]);

  // Keep keyboard focus on the selected day when it changes via keys.
  const focusAfterMove = useRef(false);
  useEffect(() => {
    if (!focusAfterMove.current) return;
    focusAfterMove.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${selected}"]`)?.focus();
  }, [selected, month]);

  function shift(days: number) {
    const d = parseLocal(selected);
    d.setDate(d.getDate() + days);
    go(toLocalDate(d));
  }
  function go(day: string) {
    focusAfterMove.current = true;
    onSelect(day);
    if (day.slice(0, 7) !== month) onMonthChange(day.slice(0, 7));
  }
  function addMonths(n: number) {
    const d = parseLocal(selected);
    d.setMonth(d.getMonth() + n);
    go(toLocalDate(d));
  }
  function onKey(e: React.KeyboardEvent) {
    const map: Record<string, () => void> = {
      ArrowLeft: () => shift(-1), ArrowRight: () => shift(1), ArrowUp: () => shift(-7), ArrowDown: () => shift(7),
      PageUp: () => addMonths(-1), PageDown: () => addMonths(1),
      Home: () => shift(-((parseLocal(selected).getDay() + 6) % 7)), End: () => shift(6 - ((parseLocal(selected).getDay() + 6) % 7)),
    };
    const fn = map[e.key];
    if (fn) { e.preventDefault(); fn(); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold text-base" aria-live="polite">{label}</h2>
        <div className="ms-auto flex gap-1">
          <Button size="icon-sm" variant="outline" aria-label="Previous month" onClick={() => addMonths(-1)}><ChevronLeftIcon aria-hidden /></Button>
          <Button size="sm" variant="outline" onClick={() => go(today)}>Today</Button>
          <Button size="icon-sm" variant="outline" aria-label="Next month" onClick={() => addMonths(1)}><ChevronRightIcon aria-hidden /></Button>
        </div>
      </div>
      <div ref={gridRef} role="grid" aria-label={`${label} calendar`} onKeyDown={onKey} className="overflow-hidden rounded-xl border">
        <div role="row" className="grid grid-cols-7 border-b bg-muted/60">
          {WEEKDAYS.map((w) => <div key={w} role="columnheader" className="px-2 py-1.5 font-medium text-muted-foreground text-xs">{w}</div>)}
        </div>
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <div key={row} role="row" className="grid grid-cols-7">
            {days.slice(row * 7, row * 7 + 7).map((d) => {
              const evs = byDay.get(d) ?? [];
              const inMonth = d.slice(0, 7) === month;
              const isSel = d === selected;
              return (
                <div key={d} role="gridcell" aria-selected={isSel} className="min-h-24 border-e border-b last:border-e-0 [&:nth-child(7n)]:border-e-0">
                  <button
                    type="button"
                    data-day={d}
                    tabIndex={isSel ? 0 : -1}
                    onClick={() => onSelect(d)}
                    aria-label={`${parseLocal(d).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}${evs.length ? `, ${evs.length} item${evs.length > 1 ? "s" : ""}` : ""}${d === today ? ", today" : ""}`}
                    className={cn("flex size-full min-h-24 flex-col items-stretch gap-1 p-1.5 text-start outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                      !inMonth && "text-muted-foreground", isSel && "bg-accent-soft")}
                  >
                    <span className={cn("grid size-6 place-items-center rounded-full text-xs tabular-nums", d === today && "bg-primary font-semibold text-primary-foreground")}>{Number(d.slice(8))}</span>
                    {evs.slice(0, 3).map((e) => (
                      <span key={e.id} className={cn("flex items-center gap-1 truncate rounded px-1 py-0.5 text-[11px] leading-tight",
                        e.kind === "demo" ? "bg-[var(--stage-demo-bg)] text-[var(--stage-demo)]" : "bg-muted text-foreground", e.done && "line-through opacity-60")}>
                        {e.kind === "demo" ? <PresentationIcon aria-hidden className="size-3 shrink-0" /> : <ListChecksIcon aria-hidden className="size-3 shrink-0" />}
                        <span className="truncate">{e.time ? `${e.time} ` : ""}{e.label}</span>
                      </span>
                    ))}
                    {evs.length > 3 && <span className="px-1 text-[11px] text-muted-foreground">+{evs.length - 3} more</span>}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
