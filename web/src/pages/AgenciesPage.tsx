import { type ColumnDef, flexRender, getCoreRowModel, getSortedRowModel, type SortingState, useReactTable } from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, Building2Icon, ExternalLinkIcon, PhoneIcon, PlusIcon, SearchIcon, Trash2Icon, XIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/app/AppProvider";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorAlert } from "@/components/app/ErrorAlert";
import { PageHeader } from "@/components/app/PageHeader";
import { SimpleSelect } from "@/components/app/SimpleSelect";
import { STAGE_ICON, StageBadge } from "@/components/app/StageBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuItem, ContextMenuPopup, ContextMenuSeparator, ContextMenuSub, ContextMenuSubPopup, ContextMenuSubTrigger, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Frame } from "@/components/ui/frame";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { agencyName } from "@/lib/agency";
import { segmentedControlItemVariants, segmentedControlRootClassName } from "@/lib/segmented-control";
import { api } from "@/lib/api";
import { APARTMENTS_LABEL, STAGES, STAGE_LABEL } from "@/lib/constants";
import { notifyChange, pendingDeletes } from "@/lib/events";
import { fmtDate, todayLocal } from "@/lib/format";
import { withUndo } from "@/lib/notify";
import { navigate } from "@/lib/router";
import { changeStage } from "@/lib/stage";
import type { AgencyListItem, Apartments, Stage } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filters = { q: string; stage: Stage | "all"; apt: Apartments | "all"; due: "all" | "overdue" | "week" | "none" };
const DEFAULT_FILTERS: Filters = { q: "", stage: "all", apt: "all", due: "all" };
const KEY = "hq.agencyFilters";

function loadFilters(): Filters {
  try { return { ...DEFAULT_FILTERS, ...JSON.parse(sessionStorage.getItem(KEY) || "{}") }; } catch { return DEFAULT_FILTERS; }
}

/**
 * Agencies grid (TanStack Table). Names are YOUR data only: your label or the
 * name you typed. Google details are fetched live only when you open one.
 */
export function AgenciesPage() {
  const { agencies, agenciesError, refreshAgencies, openQuickLog, askDeclineReason } = useApp();
  const [loaded, setLoaded] = useState(agencies.length > 0);
  const [local, setLocal] = useState<AgencyListItem[]>(agencies);
  const [filters, setFilters] = useState<Filters>(() => {
    const f = loadFilters();
    const stage = new URLSearchParams(window.location.hash.split("?")[1] || "").get("stage");
    return stage && (STAGES as string[]).includes(stage) ? { ...f, stage: stage as Stage } : f;
  });
  const [sorting, setSorting] = useState<SortingState>([{ id: "next_follow_up", desc: false }]);
  const [active, setActive] = useState(0);
  const [menuRow, setMenuRow] = useState<AgencyListItem | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const today = todayLocal();
  const in7 = todayLocal(7);

  useEffect(() => { void refreshAgencies().finally(() => setLoaded(true)); }, [refreshAgencies]);
  useEffect(() => { setLocal(agencies.filter((a) => !pendingDeletes.has(a.id))); }, [agencies]);
  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify(filters)); } catch { /* ignore */ } }, [filters]);
  useEffect(() => {
    if (sessionStorage.getItem("hq.focusSearch")) { sessionStorage.removeItem("hq.focusSearch"); searchRef.current?.focus(); }
  }, []);

  const rows = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return local.filter((a) => {
      if (q && !`${agencyName(a)} ${a.decision_maker_name ?? ""}`.toLowerCase().includes(q)) return false;
      if (filters.stage !== "all" && a.pipeline_stage !== filters.stage) return false;
      if (filters.apt !== "all" && a.handles_apartments !== filters.apt) return false;
      if (filters.due === "overdue" && !(a.next_follow_up && a.next_follow_up < today)) return false;
      if (filters.due === "week" && !(a.next_follow_up && a.next_follow_up <= in7)) return false;
      if (filters.due === "none" && a.next_follow_up) return false;
      return true;
    });
  }, [local, filters, today, in7]);

  const columns = useMemo<ColumnDef<AgencyListItem>[]>(() => [
    {
      id: "name", header: "Agency", accessorFn: (a) => agencyName(a).toLowerCase(),
      cell: ({ row: { original: a } }) => (
        <div className="min-w-0">
          <a href={`#/agency/${a.id}`} tabIndex={-1} className="block truncate font-medium text-foreground hover:underline">{agencyName(a)}</a>
          <p className="truncate text-muted-foreground text-xs">
            {a.source === "sample" ? "Fake sample" : a.source === "manual" ? "Added by hand" : a.label ? "Google listing" : "Google listing · open for live details"}
            {a.decision_maker_name ? ` · ${a.decision_maker_name}` : ""}
          </p>
        </div>
      ),
    },
    { id: "pipeline_stage", header: "Stage", accessorFn: (a) => STAGES.indexOf(a.pipeline_stage), cell: ({ row }) => <StageBadge stage={row.original.pipeline_stage} /> },
    {
      id: "handles_apartments", header: "Apartments", accessorKey: "handles_apartments",
      cell: ({ row }) => {
        const v = row.original.handles_apartments;
        return <Badge variant={v === "yes" ? "success" : v === "no" ? "error" : "outline"}>{APARTMENTS_LABEL[v]}</Badge>;
      },
    },
    {
      id: "next_follow_up", header: "Next follow-up", accessorFn: (a) => a.next_follow_up ?? "9999", sortUndefined: "last",
      cell: ({ row }) => {
        const d = row.original.next_follow_up;
        if (!d) return <span className="text-muted-foreground">-</span>;
        const overdue = d < today;
        return <span className={cn("tabular-nums", overdue && "font-medium text-destructive-foreground")}>{fmtDate(d)}{overdue && <span className="sr-only"> (overdue)</span>}</span>;
      },
    },
    {
      id: "last_contact", header: "Last contact", accessorFn: (a) => a.last_contact ?? "",
      cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.original.last_contact ? fmtDate(row.original.last_contact) : "-"}</span>,
    },
  ], [today]);

  const table = useReactTable({ data: rows, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });
  const sorted = table.getRowModel().rows;
  useEffect(() => { setActive((i) => Math.min(i, Math.max(sorted.length - 1, 0))); }, [sorted.length]);

  function focusRow(i: number) {
    const idx = Math.max(0, Math.min(i, sorted.length - 1));
    setActive(idx);
    bodyRef.current?.querySelectorAll<HTMLTableRowElement>("tr[data-row]")[idx]?.focus();
  }

  function onRowKey(e: React.KeyboardEvent, i: number, a: AgencyListItem) {
    if (e.key === "Enter") { e.preventDefault(); navigate(`/agency/${a.id}`); }
    else if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); focusRow(i + 1); }
    else if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); if (i === 0) searchRef.current?.focus(); else focusRow(i - 1); }
    else if (e.key === "Home") { e.preventDefault(); focusRow(0); }
    else if (e.key === "End") { e.preventDefault(); focusRow(sorted.length - 1); }
  }

  async function move(a: AgencyListItem, to: Stage) {
    await changeStage({
      id: a.id, from: a.pipeline_stage, to, askReason: askDeclineReason,
      apply: (s) => setLocal((l) => l.map((x) => (x.id === a.id ? { ...x, pipeline_stage: s } : x))),
      rollback: (s) => setLocal((l) => l.map((x) => (x.id === a.id ? { ...x, pipeline_stage: s } : x))),
    });
  }

  function remove(a: AgencyListItem) {
    withUndo(`Deleted "${agencyName(a)}"`, {
      hide: () => { pendingDeletes.add(a.id); setLocal((l) => l.filter((x) => x.id !== a.id)); },
      restore: () => { pendingDeletes.delete(a.id); void refreshAgencies(); },
      commit: async () => { await api(`/agencies/${a.id}`, { method: "DELETE" }); pendingDeletes.delete(a.id); notifyChange({ kind: "delete" }); },
    });
  }

  const filtered = filters.q || filters.stage !== "all" || filters.apt !== "all" || filters.due !== "all";

  return (
    <>
      <PageHeader
        title="Agencies"
        description={<>Your saved agencies. <Kbd>/</Kbd> search · <Kbd>↑</Kbd><Kbd>↓</Kbd> move · <Kbd>↵</Kbd> open · right-click for actions</>}
        actions={<>
          <Button variant="outline" render={<a href="#/agencies/new" />}><PlusIcon aria-hidden />Add by hand</Button>
          <Button render={<a href="#/search" />}><SearchIcon aria-hidden />Find agencies</Button>
        </>}
      />
      {agenciesError && <ErrorAlert error={agenciesError} onRetry={() => void refreshAgencies()} />}

      {!loaded ? <Skeleton className="h-96 rounded-xl" /> : local.length === 0 ? (
        <Frame>
          <EmptyState icon={Building2Icon} title="No agencies yet" description="Search Google for agencies that handle apartment insurance, or add one you found yourself."
            action={<div className="flex gap-2"><Button render={<a href="#/search" />}><SearchIcon aria-hidden />Search Google</Button><Button variant="outline" render={<a href="#/agencies/new" />}><PlusIcon aria-hidden />Add by hand</Button></div>} />
        </Frame>
      ) : (
        <>
          <div role="search" className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-72">
              <SearchIcon aria-hidden className="pointer-events-none absolute start-2.5 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input ref={searchRef} data-search type="search" aria-label="Search agencies" placeholder="Search agencies…" className="ps-8" value={filters.q}
                onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                onKeyDown={(e) => { if ((e.key === "ArrowDown" || e.key === "Enter") && sorted.length) { e.preventDefault(); focusRow(0); } }} />
            </div>
            <SimpleSelect label="Filter by stage" value={filters.stage} onChange={(v) => setFilters((f) => ({ ...f, stage: v }))}
              items={[{ value: "all" as const, label: "All stages" }, ...STAGES.map((s) => { const I = STAGE_ICON[s]; return { value: s, label: STAGE_LABEL[s], icon: <I aria-hidden className="size-3.5" /> }; })]} />
            {/* Exclusive filter -> Toggle Group with coss segmented-control styling. */}
            <ToggleGroup aria-label="Filter by apartments" value={[filters.apt]} className={segmentedControlRootClassName}
              onValueChange={(v) => setFilters((f) => ({ ...f, apt: (v[0] as Filters["apt"]) ?? "all" }))}>
              {([["all", "Any"], ["yes", "Apts: yes"], ["no", "No"], ["unknown", "Unknown"]] as const).map(([v, l]) => (
                <ToggleGroupItem key={v} value={v} className={segmentedControlItemVariants({ size: "sm", state: "pressed" })}>{l}</ToggleGroupItem>
              ))}
            </ToggleGroup>
            <SimpleSelect label="Filter by next follow-up" value={filters.due} onChange={(v) => setFilters((f) => ({ ...f, due: v }))}
              items={[{ value: "all", label: "Any follow-up" }, { value: "overdue", label: "Overdue" }, { value: "week", label: "Due within 7 days" }, { value: "none", label: "No follow-up" }]} />
            {filtered && <Button variant="ghost" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}><XIcon aria-hidden />Clear</Button>}
            <span className="ms-auto text-muted-foreground text-sm tabular-nums" aria-live="polite">{rows.length} of {local.length}</span>
          </div>

          <Frame className="overflow-x-auto p-0">
            <ContextMenu>
              <ContextMenuTrigger render={<div />}>
                <table className="w-full min-w-[44rem] text-sm" aria-label="Agencies" aria-rowcount={sorted.length}>
                  <thead>
                    {table.getHeaderGroups().map((hg) => (
                      <tr key={hg.id} className="border-b">
                        {hg.headers.map((h) => {
                          const dir = h.column.getIsSorted();
                          return (
                            <th key={h.id} scope="col" aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"} className="h-10 px-4 text-start font-medium text-muted-foreground text-xs">
                              <button type="button" onClick={h.column.getToggleSortingHandler()} className="inline-flex items-center gap-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                                {flexRender(h.column.columnDef.header, h.getContext())}
                                {dir === "asc" ? <ArrowUpIcon aria-hidden className="size-3.5" /> : dir === "desc" ? <ArrowDownIcon aria-hidden className="size-3.5" /> : <ArrowUpDownIcon aria-hidden className="size-3.5 opacity-40" />}
                              </button>
                            </th>
                          );
                        })}
                      </tr>
                    ))}
                  </thead>
                  <tbody ref={bodyRef}>
                    {sorted.length === 0 && (
                      <tr><td colSpan={columns.length}><EmptyState icon={SearchIcon} title="No matches" description="No agency matches these filters." action={<Button variant="outline" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>Clear filters</Button>} /></td></tr>
                    )}
                    {sorted.map((row, i) => (
                      <tr key={row.id} data-row tabIndex={i === active ? 0 : -1} aria-label={`Open ${agencyName(row.original)}`}
                        className="cursor-pointer border-b outline-none last:border-0 hover:bg-accent focus-visible:bg-accent focus-visible:shadow-[inset_2px_0_0_var(--ring)]"
                        onClick={(e) => { if (!(e.target as HTMLElement).closest("a,button")) navigate(`/agency/${row.original.id}`); }}
                        onFocus={() => setActive(i)} onKeyDown={(e) => onRowKey(e, i, row.original)}
                        onContextMenu={() => setMenuRow(row.original)}>
                        {row.getVisibleCells().map((c) => <td key={c.id} className="max-w-80 px-4 py-2.5 align-middle">{flexRender(c.column.columnDef.cell, c.getContext())}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ContextMenuTrigger>
              <ContextMenuPopup>
                {menuRow && <>
                  <ContextMenuItem onClick={() => navigate(`/agency/${menuRow.id}`)}><ExternalLinkIcon aria-hidden />Open</ContextMenuItem>
                  <ContextMenuItem onClick={() => openQuickLog({ agencyId: menuRow.id })}><PhoneIcon aria-hidden />Log a call</ContextMenuItem>
                  <ContextMenuSub>
                    <ContextMenuSubTrigger>Move to…</ContextMenuSubTrigger>
                    <ContextMenuSubPopup>
                      {STAGES.filter((s) => s !== menuRow.pipeline_stage).map((s) => { const I = STAGE_ICON[s]; return <ContextMenuItem key={s} onClick={() => void move(menuRow, s)}><I aria-hidden />{STAGE_LABEL[s]}</ContextMenuItem>; })}
                    </ContextMenuSubPopup>
                  </ContextMenuSub>
                  <ContextMenuSeparator />
                  <ContextMenuItem variant="destructive" onClick={() => remove(menuRow)}><Trash2Icon aria-hidden />Delete…</ContextMenuItem>
                </>}
              </ContextMenuPopup>
            </ContextMenu>
          </Frame>
        </>
      )}
    </>
  );
}
