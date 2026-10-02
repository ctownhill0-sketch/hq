import { Building2Icon, CalendarIcon, CheckCircle2Icon, KanbanSquareIcon, ListChecksIcon, ListPlusIcon, MessagesSquareIcon, PhoneIcon, SearchIcon, SparklesIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { AddTaskDialog } from "@/components/app/AddTaskDialog";
import { useApp } from "@/components/app/AppProvider";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorAlert } from "@/components/app/ErrorAlert";
import { PageHeader } from "@/components/app/PageHeader";
import { STAGE_FILL, StageBadge } from "@/components/app/StageBadge";
import { TaskList } from "@/components/app/TaskList";
import { UsageMeters } from "@/components/app/UsageMeters";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/useApi";
import { agencyName } from "@/lib/agency";
import { STAGES, STAGE_LABEL } from "@/lib/constants";
import { onChange } from "@/lib/events";
import { fmtDateTime } from "@/lib/format";
import { replaceQuery } from "@/lib/router";
import type { Demo, Stage, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Dashboard {
  overdue: Task[]; today: Task[]; upcoming: Task[]; demos: Demo[];
  pipeline: Partial<Record<Stage, number>>;
  needs_research: { id: number; label: string | null; manual_name: string | null; source: string; pipeline_stage: Stage }[];
  stats: { agencies: number; calls_week: number; conversations_week: number; open_tasks: number };
}

export function TodayPage({ query }: { query: URLSearchParams }) {
  const { data, error, loading, reload } = useApi<Dashboard>("/dashboard");
  const { openQuickLog } = useApp();
  const [taskOpen, setTaskOpen] = useState(false);
  useEffect(() => onChange(() => void reload({ quiet: true })), [reload]);
  useEffect(() => {
    if (query.get("newtask")) { setTaskOpen(true); replaceQuery("/today", { newtask: null }); }
  }, [query]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const due = data ? data.overdue.length + data.today.length : 0;

  return (
    <>
      <PageHeader
        title={greeting}
        description={<span className="tabular-nums">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}{data && ` · ${due ? `${due} follow-up${due === 1 ? "" : "s"} need you today` : "nothing due today"}`}</span>}
        actions={<>
          <Button variant="outline" onClick={() => openQuickLog()}><PhoneIcon aria-hidden />Log call</Button>
          <Button variant="outline" onClick={() => setTaskOpen(true)}><ListPlusIcon aria-hidden />Add task</Button>
          <Button render={<a href="#/search" />}><SearchIcon aria-hidden />Find agencies</Button>
        </>}
      />
      {error && <ErrorAlert error={error} onRetry={() => void reload()} />}
      {loading && !data ? <TodaySkeleton /> : data && (
        <div className="space-y-5">
          <section aria-label="Quick stats" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Agencies" value={data.stats.agencies} icon={Building2Icon} sub="in your workspace" />
            <Stat label="Calls (7 days)" value={data.stats.calls_week} icon={PhoneIcon} sub="logged this week" />
            <Stat label="Conversations (7 days)" value={data.stats.conversations_week} icon={MessagesSquareIcon} sub="unique agencies" />
            <Stat label="Open tasks" value={data.stats.open_tasks} icon={ListChecksIcon} sub={`${data.overdue.length} overdue`} />
          </section>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div className="space-y-5">
              <Card className="gap-0 py-0">
                <CardHeader className="border-b py-4">
                  <CardTitle className="flex items-center gap-2 text-base"><CheckCircle2Icon aria-hidden className="size-4 text-muted-foreground" />Follow-ups</CardTitle>
                  <CardAction className="self-center"><a className="text-muted-foreground text-sm hover:text-foreground hover:underline" href="#/followups">Calendar</a></CardAction>
                </CardHeader>
                {data.overdue.length + data.today.length + data.upcoming.length === 0 ? (
                  <EmptyState icon={CheckCircle2Icon} title="You're all caught up" description="No follow-ups due. Log a call with a next action and it lands here."
                    action={<Button variant="outline" onClick={() => openQuickLog()}><PhoneIcon aria-hidden />Log a call</Button>} />
                ) : (
                  <div>
                    {([["Overdue", data.overdue], ["Today", data.today], ["Next 7 days", data.upcoming]] as const).map(([label, tasks]) => tasks.length > 0 && (
                      <section key={label} aria-label={label}>
                        <h3 className={cn("px-5 pt-3 pb-1 font-medium text-xs", label === "Overdue" ? "text-destructive-foreground" : "text-muted-foreground")}>
                          {label} <span className="tabular-nums">{tasks.length}</span>
                        </h3>
                        <TaskList tasks={tasks} />
                      </section>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="gap-0 py-0">
                <CardHeader className="border-b py-4">
                  <CardTitle className="flex items-center gap-2 text-base"><CalendarIcon aria-hidden className="size-4 text-muted-foreground" />Upcoming demos</CardTitle>
                </CardHeader>
                {data.demos.length ? (
                  <ul className="divide-y">
                    {data.demos.map((d) => (
                      <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                        <div className="min-w-0 flex-1">
                          <a href={`#/agency/${d.agency_id}?tab=tasks`} className="block truncate font-medium text-sm hover:underline">{d.agency_name || `Agency #${d.agency_id}`}</a>
                          {d.notes && <p className="truncate text-muted-foreground text-xs">{d.notes}</p>}
                        </div>
                        <span className="shrink-0 text-muted-foreground text-xs tabular-nums">{fmtDateTime(d.scheduled_at)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState icon={CalendarIcon} title="No demos scheduled" description="Book one from an agency's Tasks tab after a good conversation." />
                )}
              </Card>
            </div>

            <div className="space-y-5">
              <PipelineSnapshot pipeline={data.pipeline} />
              <Card className="gap-0 py-0">
                <CardHeader className="border-b py-4">
                  <CardTitle className="flex items-center gap-2 text-base"><SparklesIcon aria-hidden className="size-4 text-muted-foreground" />Needs research</CardTitle>
                </CardHeader>
                {data.needs_research.length ? (
                  <ul className="divide-y">
                    {data.needs_research.map((a) => (
                      <li key={a.id} className="flex items-center gap-3 px-5 py-2.5">
                        <a href={`#/agency/${a.id}`} className="min-w-0 flex-1 truncate text-sm hover:underline">{agencyName(a as never)}</a>
                        <StageBadge stage={a.pipeline_stage} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState icon={SparklesIcon} title="Nothing waiting" description="Every active agency has been researched." />
                )}
              </Card>
              <Card className="gap-0 p-4">
                <UsageMeters />
              </Card>
            </div>
          </div>
        </div>
      )}
      <AddTaskDialog open={taskOpen} onOpenChange={setTaskOpen} />
    </>
  );
}

function Stat({ label, value, icon: Icon, sub }: { label: string; value: number; icon: typeof PhoneIcon; sub: string }) {
  return (
    <Card className="gap-0 py-3.5">
      <CardPanel className="space-y-0.5 px-5">
        <p className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs"><Icon aria-hidden className="size-3.5" />{label}</p>
        <p className="font-semibold text-3xl tabular-nums tracking-tight">{value}</p>
        <p className="text-muted-foreground text-xs">{sub}</p>
      </CardPanel>
    </Card>
  );
}

function PipelineSnapshot({ pipeline }: { pipeline: Partial<Record<Stage, number>> }) {
  const total = STAGES.reduce((n, s) => n + (pipeline[s] ?? 0), 0);
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="flex items-center gap-2 text-base"><KanbanSquareIcon aria-hidden className="size-4 text-muted-foreground" />Pipeline</CardTitle>
        <CardAction className="self-center"><a className="text-muted-foreground text-sm hover:text-foreground hover:underline" href="#/pipeline">Open board</a></CardAction>
      </CardHeader>
      <CardPanel className="space-y-4 py-4">
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={STAGES.map((s) => `${STAGE_LABEL[s]} ${pipeline[s] ?? 0}`).join(", ")}>
          {STAGES.filter((s) => pipeline[s]).map((s) => (
            <span key={s} className={cn("h-full", STAGE_FILL[s])} style={{ flexGrow: pipeline[s] }} />
          ))}
        </div>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {STAGES.map((s) => (
            <li key={s} className="flex items-center justify-between gap-2">
              <StageBadge stage={s} />
              <span className="text-muted-foreground text-sm tabular-nums">{pipeline[s] ?? 0}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground text-xs tabular-nums">{total} agencies in total</p>
      </CardPanel>
    </Card>
  );
}

function TodaySkeleton() {
  // Fixed sizes that match the real layout, so nothing shifts when data arrives.
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[7.25rem] rounded-xl" />)}</div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}
