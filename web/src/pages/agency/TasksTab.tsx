import { CalendarIcon, ListChecksIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/app/EmptyState";
import { SaveIndicator } from "@/components/app/SaveIndicator";
import { TaskList } from "@/components/app/TaskList";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAutosave } from "@/hooks/useAutosave";
import { api } from "@/lib/api";
import { notifyChange } from "@/lib/events";
import { fmtDateTime, todayLocal } from "@/lib/format";
import { notify, notifyError, withUndo } from "@/lib/notify";
import type { Demo, Task } from "@/lib/types";

export function TasksTab({ agencyId, tasks, demos, focusNew }: { agencyId: number; tasks: Task[]; demos: Demo[]; focusNew: boolean }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(todayLocal(1));
  const [adding, setAdding] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (focusNew) titleRef.current?.focus(); }, [focusNew]);

  const sorted = [...tasks].sort((a, b) => (a.status === b.status ? (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") : a.status === "open" ? -1 : 1));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { titleRef.current?.focus(); return; }
    setAdding(true);
    try {
      await api("/tasks", { method: "POST", body: { title: title.trim(), due_date: due || null, agency_id: agencyId } });
      setTitle("");
      notifyChange({ agencyId, kind: "task" });
    } catch (x) { notifyError((x as Error).message, "Task not added"); } finally { setAdding(false); titleRef.current?.focus(); }
  }

  return (
    <div className="space-y-5">
      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4"><CardTitle className="flex items-center gap-2 text-base"><ListChecksIcon aria-hidden className="size-4 text-muted-foreground" />Tasks</CardTitle></CardHeader>
        <form onSubmit={add} className="flex flex-wrap items-end gap-2 border-b px-5 py-3">
          <Field className="min-w-48 flex-1"><FieldLabel className="sr-only">New task</FieldLabel><Input ref={titleRef} value={title} maxLength={300} placeholder="Add a task…" aria-label="New task" onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field className="w-40"><FieldLabel className="sr-only">Due date</FieldLabel><Input type="date" value={due} aria-label="Due date" onChange={(e) => setDue(e.target.value)} /></Field>
          <Button type="submit" loading={adding}><PlusIcon aria-hidden />Add</Button>
        </form>
        {sorted.length ? <TaskList tasks={sorted} showAgency={false} allowDelete /> : <EmptyState icon={ListChecksIcon} title="No tasks" description="Add one above, or log a call with a next action." />}
      </Card>
      <DemosCard agencyId={agencyId} demos={demos} />
    </div>
  );
}

function DemosCard({ agencyId, demos }: { agencyId: number; demos: Demo[] }) {
  const [when, setWhen] = useState("");
  const [notes, setNotes] = useState("");
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  async function schedule(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(`/agencies/${agencyId}/demos`, { method: "POST", body: { scheduled_at: when, notes: notes || null } });
      setWhen(""); setNotes("");
      notify("Demo scheduled");
      notifyChange({ agencyId, kind: "demo" });
    } catch (x) { notifyError((x as Error).message, "Demo not scheduled"); }
  }
  const visible = demos.filter((d) => !hidden.has(d.id));
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4"><CardTitle className="flex items-center gap-2 text-base"><CalendarIcon aria-hidden className="size-4 text-muted-foreground" />Demos</CardTitle></CardHeader>
      <form onSubmit={schedule} className="flex flex-wrap items-end gap-2 border-b px-5 py-3">
        <Field className="w-56"><FieldLabel>When</FieldLabel><Input type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
        <Field className="min-w-40 flex-1"><FieldLabel>Notes</FieldLabel><Input value={notes} maxLength={4000} placeholder="Optional" onChange={(e) => setNotes(e.target.value)} /></Field>
        <Button type="submit" variant="outline" disabled={!when}><CalendarIcon aria-hidden />Schedule</Button>
      </form>
      {visible.length ? (
        <ul className="divide-y">{visible.map((d) => <DemoRow key={d.id} demo={d} onDelete={() => withUndo("Demo deleted", {
          hide: () => setHidden((h) => new Set(h).add(d.id)),
          restore: () => setHidden((h) => { const n = new Set(h); n.delete(d.id); return n; }),
          commit: () => api(`/demos/${d.id}`, { method: "DELETE" }).then(() => notifyChange({ agencyId, kind: "demo" })),
        })} />)}</ul>
      ) : (
        <EmptyState icon={CalendarIcon} title="No demos yet" description="Schedule one after a good conversation. You demonstrate with fictional documents only." />
      )}
    </Card>
  );
}

function DemoRow({ demo, onDelete }: { demo: Demo; onDelete: () => void }) {
  const a = useAutosave((patch) => api(`/demos/${demo.id}`, { method: "PATCH", body: patch }));
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3">
      <div className="min-w-40 flex-1">
        <p className="font-medium text-sm tabular-nums">{fmtDateTime(demo.scheduled_at)}</p>
        {demo.notes && <p className="truncate text-muted-foreground text-xs">{demo.notes}</p>}
      </div>
      <Input className="w-64" aria-label="Demo outcome" placeholder="Outcome (saves automatically)" defaultValue={demo.outcome ?? ""} maxLength={2000}
        onChange={(e) => a.change("outcome", e.target.value)} onBlur={(e) => a.change("outcome", e.target.value, 0)} aria-invalid={a.invalid.outcome || undefined} />
      <SaveIndicator state={a.state} />
      <Button size="icon-xs" variant="ghost" aria-label="Delete demo" onClick={onDelete}><Trash2Icon aria-hidden /></Button>
    </li>
  );
}
