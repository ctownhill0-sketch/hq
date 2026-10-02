import { CalendarClockIcon, CheckCircle2Icon, PhoneIcon, PresentationIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/app/AppProvider";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorAlert } from "@/components/app/ErrorAlert";
import { type CalEvent, MonthCalendar } from "@/components/app/MonthCalendar";
import { PageHeader } from "@/components/app/PageHeader";
import { TaskList } from "@/components/app/TaskList";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/useApi";
import { onChange } from "@/lib/events";
import { fmtTime, parseLocal, todayLocal } from "@/lib/format";
import type { Demo, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Followups { today: Task[]; overdue: Task[]; upcoming: Task[]; undated: Task[]; demos: Demo[] }
interface Month { demos: Demo[]; tasks: Task[] }

export function FollowupsPage() {
  const { openQuickLog } = useApp();
  const list = useApi<Followups>("/followups");
  const [month, setMonth] = useState(todayLocal().slice(0, 7));
  const [selected, setSelected] = useState(todayLocal());
  const cal = useApi<Month>(`/calendar?month=${month}`);
  useEffect(() => onChange(() => { void list.reload({ quiet: true }); void cal.reload({ quiet: true }); }), [list.reload, cal.reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const events = useMemo<CalEvent[]>(() => [
    ...(cal.data?.demos ?? []).map((d) => ({ id: `d${d.id}`, date: d.scheduled_at.slice(0, 10), label: d.agency_name || `Agency #${d.agency_id}`, kind: "demo" as const, time: fmtTime(d.scheduled_at) })),
    ...(cal.data?.tasks ?? []).map((t) => ({ id: `t${t.id}`, date: t.due_date as string, label: t.title, kind: "task" as const, done: t.status === "done" })),
  ], [cal.data]);
  const dayDemos = (cal.data?.demos ?? []).filter((d) => d.scheduled_at.startsWith(selected));
  const dayTasks = (cal.data?.tasks ?? []).filter((t) => t.due_date === selected);
  const d = list.data;
  const groups: [string, Task[], boolean][] = d ? [["Overdue", d.overdue, true], ["Today", d.today, false], ["Next 7 days", d.upcoming, false], ["No date", d.undated, false]] : [];

  return (
    <>
      <PageHeader title="Follow-ups" description="Everything you've promised to do, and the demos you've booked."
        actions={<Button variant="outline" onClick={() => openQuickLog()}><PhoneIcon aria-hidden />Log call</Button>} />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <Card className="gap-0 py-0">
          <CardHeader className="border-b py-4"><CardTitle className="flex items-center gap-2 text-base"><CheckCircle2Icon aria-hidden className="size-4 text-muted-foreground" />To do</CardTitle></CardHeader>
          {list.error ? <CardPanel className="py-4"><ErrorAlert error={list.error} onRetry={() => void list.reload()} /></CardPanel>
            : !d ? <CardPanel className="space-y-3 py-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</CardPanel>
            : groups.every(([, t]) => t.length === 0) ? (
              <EmptyState icon={CheckCircle2Icon} title="You're all caught up" description="Log a call with a next action and it shows up here." action={<Button variant="outline" onClick={() => openQuickLog()}><PhoneIcon aria-hidden />Log a call</Button>} />
            ) : groups.map(([label, tasks, overdue]) => tasks.length > 0 && (
              <section key={label} aria-label={label}>
                <h3 className={cn("px-5 pt-3 pb-1 font-medium text-xs", overdue ? "text-destructive-foreground" : "text-muted-foreground")}>{label} <span className="tabular-nums">{tasks.length}</span></h3>
                <TaskList tasks={tasks} />
              </section>
            ))}
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b py-4"><CardTitle className="flex items-center gap-2 text-base"><CalendarClockIcon aria-hidden className="size-4 text-muted-foreground" />Calendar</CardTitle></CardHeader>
          <CardPanel className="space-y-4 py-4">
            {cal.error ? <ErrorAlert error={cal.error} onRetry={() => void cal.reload()} /> : (
              <MonthCalendar month={month} onMonthChange={setMonth} events={events} selected={selected} onSelect={setSelected} />
            )}
            <section aria-label="Selected day" className="space-y-2">
              <h3 className="font-medium text-sm">{parseLocal(selected).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h3>
              {dayDemos.length + dayTasks.length === 0 ? <p className="text-muted-foreground text-sm">Nothing scheduled.</p> : (
                <ul className="space-y-1.5 text-sm">
                  {dayDemos.map((x) => (
                    <li key={`d${x.id}`} className="flex items-center gap-2">
                      <PresentationIcon aria-hidden className="size-4 text-[var(--stage-demo)]" />
                      <span className="tabular-nums text-muted-foreground">{fmtTime(x.scheduled_at)}</span>
                      <a href={`#/agency/${x.agency_id}?tab=tasks`} className="truncate hover:underline">Demo · {x.agency_name || `Agency #${x.agency_id}`}</a>
                    </li>
                  ))}
                  {dayTasks.map((t) => (
                    <li key={`t${t.id}`} className={cn("flex items-center gap-2", t.status === "done" && "text-muted-foreground line-through")}>
                      <CheckCircle2Icon aria-hidden className="size-4 text-muted-foreground" />
                      {t.agency_id ? <a href={`#/agency/${t.agency_id}`} className="truncate hover:underline">{t.title}</a> : <span className="truncate">{t.title}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </CardPanel>
        </Card>
      </div>
    </>
  );
}
