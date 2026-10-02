import { ArrowRightLeftIcon, CalendarIcon, GripVerticalIcon, KanbanSquareIcon, SearchIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/app/AppProvider";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorAlert } from "@/components/app/ErrorAlert";
import { PageHeader } from "@/components/app/PageHeader";
import { STAGE_ICON, StageBadge } from "@/components/app/StageBadge";
import { Kanban, KanbanBoard, KanbanColumn, KanbanColumnContent, KanbanItem, KanbanItemHandle, KanbanOverlay, type KanbanCommitMeta } from "@/components/reui/kanban";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Kbd } from "@/components/ui/kbd";
import { Menu, MenuGroup, MenuGroupLabel, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { Skeleton } from "@/components/ui/skeleton";
import { agencyName } from "@/lib/agency";
import { APARTMENTS_LABEL, STAGES, STAGE_LABEL } from "@/lib/constants";
import { fmtDate, todayLocal } from "@/lib/format";
import { changeStage } from "@/lib/stage";
import type { AgencyListItem, Stage } from "@/lib/types";
import { cn } from "@/lib/utils";

type Board = Record<Stage, AgencyListItem[]>;

function toBoard(list: AgencyListItem[]): Board {
  const b = Object.fromEntries(STAGES.map((s) => [s, [] as AgencyListItem[]])) as Board;
  for (const a of list) b[a.pipeline_stage].push(a);
  return b;
}

const itemId = (a: AgencyListItem) => `agency-${a.id}`;

/**
 * Pipeline board (ReUI Kanban on @dnd-kit). Drag with a mouse or touch, or with
 * the keyboard (focus a card's handle, Space to pick up, arrow keys, Space to
 * drop). Every card also has a "Move to…" menu as a non-drag fallback.
 * Moving to "Declined" always asks for a reason; cancelling puts the card back.
 */
export function PipelinePage() {
  const { agencies, agenciesError, refreshAgencies, askDeclineReason } = useApp();
  const [board, setBoard] = useState<Board>(() => toBoard(agencies));
  const [loaded, setLoaded] = useState(agencies.length > 0);
  const dragging = useRef(false);

  useEffect(() => { void refreshAgencies().finally(() => setLoaded(true)); }, [refreshAgencies]);
  // Keep the board in sync with the shared list, except mid-drag.
  useEffect(() => { if (!dragging.current) setBoard(toBoard(agencies)); }, [agencies]);

  const byId = useMemo(() => new Map(agencies.map((a) => [itemId(a), a])), [agencies]);

  function setStageLocal(id: number, s: Stage) {
    setBoard((b) => {
      const all = STAGES.flatMap((k) => b[k]);
      const item = all.find((x) => x.id === id);
      if (!item) return b;
      const next = toBoard(all.filter((x) => x.id !== id));
      next[s] = [{ ...item, pipeline_stage: s }, ...next[s]];
      return next;
    });
  }

  async function moveTo(a: AgencyListItem, to: Stage) {
    await changeStage({
      id: a.id, from: a.pipeline_stage, to, askReason: askDeclineReason,
      apply: (s) => setStageLocal(a.id, s),
      rollback: (s) => setStageLocal(a.id, s),
    });
  }

  async function onCommit(value: Board, meta: KanbanCommitMeta<AgencyListItem>) {
    dragging.current = false;
    if (meta.kind !== "item") return;
    const id = String(meta.event.active.id);
    const from = (Object.keys(meta.previousValue) as Stage[]).find((s) => meta.previousValue[s].some((x) => itemId(x) === id));
    const to = (Object.keys(value) as Stage[]).find((s) => value[s].some((x) => itemId(x) === id));
    const a = byId.get(id);
    if (!a || !from || !to || from === to) return;
    const ok = await changeStage({
      id: a.id, from, to, askReason: askDeclineReason,
      apply: () => setBoard((b) => ({ ...b, [to]: b[to].map((x) => (itemId(x) === id ? { ...x, pipeline_stage: to } : x)) })),
      rollback: () => setBoard(meta.previousValue as Board),
    });
    if (!ok) setBoard(meta.previousValue as Board); // cancelled decline reason: card goes back
  }

  const total = STAGES.reduce((n, s) => n + board[s].length, 0);

  return (
    <>
      <PageHeader
        title="Pipeline"
        description={<>Drag cards between stages, or focus a card's handle and use <Kbd>Space</Kbd> + arrow keys. Every card has a <span className="font-medium">Move to…</span> menu.</>}
        actions={<Button variant="outline" render={<a href="#/agencies" />}>List view</Button>}
      />
      {agenciesError && <ErrorAlert error={agenciesError} onRetry={() => void refreshAgencies()} />}
      {!loaded ? (
        <div className="flex gap-3 overflow-hidden">{STAGES.map((s) => <Skeleton key={s} className="h-96 w-64 shrink-0 rounded-xl" />)}</div>
      ) : total === 0 ? (
        <Card><EmptyState icon={KanbanSquareIcon} title="No agencies in the pipeline yet" description="Save agencies from Google or add them by hand, then move them along here." action={<Button render={<a href="#/search" />}><SearchIcon aria-hidden />Find agencies</Button>} /></Card>
      ) : (
        <Kanban<AgencyListItem>
          value={board}
          onValueChange={(v) => setBoard(v as Board)}
          getItemValue={itemId}
          onDragStart={() => { dragging.current = true; }}
          onDragCancel={() => { dragging.current = false; }}
          onValueCommit={(v, m) => void onCommit(v as Board, m)}
          restoreOnCancel
          className="-mx-4 overflow-x-auto px-4 pb-4"
        >
          <KanbanBoard className="flex min-w-max items-start gap-3">
            {STAGES.map((s) => (
              <KanbanColumn key={s} value={s} aria-label={`${STAGE_LABEL[s]} column`} className="w-64 shrink-0 rounded-xl border bg-muted/60 p-2">
                <div className="mb-2 flex items-center justify-between gap-2 px-1 py-1">
                  <StageBadge stage={s} />
                  <span className="text-muted-foreground text-xs tabular-nums">{board[s].length}</span>
                </div>
                <KanbanColumnContent value={s} className="flex min-h-24 flex-col gap-2">
                  {board[s].map((a) => <AgencyCard key={a.id} agency={a} onMove={(to) => void moveTo(a, to)} />)}
                  {board[s].length === 0 && <p className="rounded-lg border border-dashed px-3 py-6 text-center text-muted-foreground text-xs">Drop here</p>}
                </KanbanColumnContent>
              </KanbanColumn>
            ))}
          </KanbanBoard>
          <KanbanOverlay>
            {({ value, variant }) => {
              const a = byId.get(String(value));
              return variant === "item" && a ? <CardBody agency={a} overlay /> : null;
            }}
          </KanbanOverlay>
        </Kanban>
      )}
    </>
  );
}

function AgencyCard({ agency, onMove }: { agency: AgencyListItem; onMove: (to: Stage) => void }) {
  return (
    <KanbanItem handle value={itemId(agency)} className="rounded-lg data-[dragging=true]:opacity-40">
      <CardBody agency={agency} onMove={onMove} />
    </KanbanItem>
  );
}

function CardBody({ agency: a, onMove, overlay }: { agency: AgencyListItem; onMove?: (to: Stage) => void; overlay?: boolean }) {
  const today = todayLocal();
  const overdue = a.next_follow_up && a.next_follow_up < today;
  return (
    <div className={cn("rounded-lg border bg-card p-3 shadow-xs/5", overlay && "rotate-1 shadow-lg")}>
      <div className="flex items-start gap-1.5">
        {overlay ? <GripVerticalIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> : (
          <KanbanItemHandle aria-label={`Move ${agencyName(a)}: press Space to pick up, arrow keys to move, Space to drop`}
            className="-ms-1 mt-0.5 grid size-5 shrink-0 cursor-grab place-items-center rounded-sm text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
            <GripVerticalIcon aria-hidden className="size-4" />
          </KanbanItemHandle>
        )}
        <a href={`#/agency/${a.id}`} className="min-w-0 flex-1 font-medium text-sm leading-snug hover:underline">{agencyName(a)}</a>
        {onMove && (
          <Menu>
            <MenuTrigger render={<Button size="icon-xs" variant="ghost" aria-label={`Move ${agencyName(a)} to…`} />}><ArrowRightLeftIcon aria-hidden /></MenuTrigger>
            <MenuPopup align="end">
              <MenuGroup>
                <MenuGroupLabel>Move to…</MenuGroupLabel>
                {STAGES.filter((s) => s !== a.pipeline_stage).map((s) => { const I = STAGE_ICON[s]; return <MenuItem key={s} onClick={() => onMove(s)}><I aria-hidden />{STAGE_LABEL[s]}</MenuItem>; })}
              </MenuGroup>
            </MenuPopup>
          </Menu>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        <Badge variant={a.handles_apartments === "yes" ? "success" : a.handles_apartments === "no" ? "error" : "outline"} size="sm">Apts: {APARTMENTS_LABEL[a.handles_apartments]}</Badge>
        {a.next_follow_up && (
          <span className={cn("inline-flex items-center gap-1 tabular-nums", overdue ? "font-medium text-destructive-foreground" : "text-muted-foreground")}>
            <CalendarIcon aria-hidden className="size-3" />{fmtDate(a.next_follow_up)}{overdue && <span className="sr-only"> (overdue)</span>}
          </span>
        )}
      </div>
    </div>
  );
}
