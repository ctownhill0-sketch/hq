import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import { notifyChange } from "@/lib/events";
import { fmtDate, todayLocal } from "@/lib/format";
import { notify, withUndo } from "@/lib/notify";
import { optimistic } from "@/lib/optimistic";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Tasks with optimistic "done" (rolled back on error), undo, and deferred delete with undo. */
export function TaskList({ tasks, showAgency = true, allowDelete = false, emptyText }: { tasks: Task[]; showAgency?: boolean; allowDelete?: boolean; emptyText?: string }) {
  const [status, setStatus] = useState<Record<number, Task["status"]>>({});
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const today = todayLocal();
  const visible = tasks.filter((t) => !hidden.has(t.id));
  if (!visible.length && emptyText) return <p className="px-5 py-4 text-muted-foreground text-sm">{emptyText}</p>;

  async function toggle(t: Task, done: boolean) {
    const prev = status[t.id] ?? t.status;
    const next: Task["status"] = done ? "done" : "open";
    const r = await optimistic({
      apply: () => setStatus((s) => ({ ...s, [t.id]: next })),
      rollback: () => setStatus((s) => ({ ...s, [t.id]: prev })),
      request: () => api(`/tasks/${t.id}`, { method: "PATCH", body: { status: next } }),
      errorTitle: "Task not updated",
    });
    if (r.ok && done) {
      notify("Task done", { type: "info", action: { label: "Undo", onClick: () => void toggle(t, false) } });
    }
    if (r.ok) notifyChange({ agencyId: t.agency_id ?? undefined, kind: "task" });
  }

  return (
    <ul className="divide-y">
      {visible.map((t) => {
        const st = status[t.id] ?? t.status;
        const overdue = st === "open" && t.due_date && t.due_date < today;
        return (
          <li key={t.id} className="flex min-h-12 items-center gap-3 px-5 py-2.5">
            <Checkbox checked={st === "done"} onCheckedChange={(c) => void toggle(t, Boolean(c))} aria-label={`Mark "${t.title}" ${st === "done" ? "not done" : "done"}`} />
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-sm", st === "done" && "text-muted-foreground line-through")}>{t.title}</p>
              {showAgency && (t.agency_id
                ? <a href={`#/agency/${t.agency_id}`} className="block truncate text-muted-foreground text-xs hover:text-foreground hover:underline">{t.agency_name || `Agency #${t.agency_id}`}</a>
                : <p className="text-muted-foreground text-xs">No agency</p>)}
            </div>
            <span className={cn("shrink-0 text-xs tabular-nums", overdue ? "font-medium text-destructive-foreground" : "text-muted-foreground")}>
              {t.due_date ? fmtDate(t.due_date) : "No date"}
              {overdue && <span className="sr-only"> (overdue)</span>}
            </span>
            {allowDelete && (
              <Button size="icon-xs" variant="ghost" aria-label={`Delete task "${t.title}"`} onClick={() => withUndo("Task deleted", {
                hide: () => setHidden((h) => new Set(h).add(t.id)),
                restore: () => setHidden((h) => { const n = new Set(h); n.delete(t.id); return n; }),
                commit: () => api(`/tasks/${t.id}`, { method: "DELETE" }).then(() => notifyChange({ agencyId: t.agency_id ?? undefined, kind: "task" })),
              })}>
                <Trash2Icon aria-hidden />
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
