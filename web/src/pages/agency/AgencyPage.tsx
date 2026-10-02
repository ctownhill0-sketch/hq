import { ChevronLeftIcon, ListPlusIcon, MailIcon, MoreHorizontalIcon, PhoneIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/app/AppProvider";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorAlert } from "@/components/app/ErrorAlert";
import { SimpleSelect } from "@/components/app/SimpleSelect";
import { STAGE_ICON } from "@/components/app/StageBadge";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { useApi } from "@/hooks/useApi";
import { agencyName } from "@/lib/agency";
import { api } from "@/lib/api";
import { STAGES, STAGE_LABEL } from "@/lib/constants";
import { notifyChange, onChange, pendingDeletes } from "@/lib/events";
import { withUndo } from "@/lib/notify";
import { navigate, replaceQuery } from "@/lib/router";
import { changeStage } from "@/lib/stage";
import type { Agency, Call, Demo, LivePlace, Stage, Task } from "@/lib/types";
import { ActivityTimeline } from "./ActivityTimeline";
import { CallsTab } from "./CallsTab";
import { NotesTab } from "./NotesTab";
import { OverviewTab } from "./OverviewTab";
import { TasksTab } from "./TasksTab";

interface AgencyData { agency: Agency; calls: Call[]; tasks: Task[]; demos: Demo[] }
const TABS = ["overview", "research", "calls", "tasks", "notes"] as const;
type Tab = (typeof TABS)[number];

export function AgencyPage({ id, query }: { id: number; query: URLSearchParams }) {
  const { data, setData, error, loading, reload } = useApi<AgencyData>(`/agencies/${id}`);
  const { openQuickLog, askDeclineReason } = useApp();
  const initialTab = (TABS as readonly string[]).includes(query.get("tab") ?? "") ? (query.get("tab") as Tab) : "overview";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [focusNewTask, setFocusNewTask] = useState(Boolean(query.get("new")));
  const [liveName, setLiveName] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reflect palette navigation (e.g. "Add task" -> ?tab=tasks&new=1).
  useEffect(() => {
    const t = query.get("tab");
    if (t && (TABS as readonly string[]).includes(t)) setTab(t as Tab);
    if (query.get("new")) { setFocusNewTask(true); replaceQuery(`/agency/${id}`, { new: null }); }
  }, [query, id]);
  useEffect(() => onChange((d) => { if (d.agencyId === id && d.kind !== "edit") void reload({ quiet: true }); }), [id, reload]);

  const patchLocal = useCallback((p: Partial<Agency>) => setData((d) => (d ? { ...d, agency: { ...d.agency, ...p } } : d)), [setData]);

  if (error) return <ErrorAlert error={error} onRetry={() => void reload()} title={error.message.includes("not found") ? "Agency not found" : undefined} />;
  if (loading || !data) return <AgencySkeleton />;
  const a = data.agency;
  const showGoogleName = a.source === "google" && !a.label && liveName;
  const openTasks = data.tasks.filter((t) => t.status === "open").length;

  function selectTab(t: Tab) {
    setTab(t);
    replaceQuery(`/agency/${id}`, { tab: t });
  }

  async function onStage(to: Stage) {
    await changeStage({
      id, from: a.pipeline_stage, to, currentReason: a.decline_reason, askReason: askDeclineReason,
      apply: (s) => patchLocal({ pipeline_stage: s }),
      rollback: (s) => patchLocal({ pipeline_stage: s }),
    });
    void reload({ quiet: true });
  }

  function deleteAgency() {
    setConfirmDelete(false);
    const name = agencyName(a);
    withUndo(`Deleted "${name}"`, {
      hide: () => { pendingDeletes.add(id); navigate("/agencies"); notifyChange({ kind: "delete" }); },
      restore: () => { pendingDeletes.delete(id); notifyChange({ kind: "restore" }); navigate(`/agency/${id}`); },
      commit: async () => { await api(`/agencies/${id}`, { method: "DELETE" }); pendingDeletes.delete(id); notifyChange({ kind: "delete" }); },
    });
  }

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <a href="#/agencies" className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"><ChevronLeftIcon aria-hidden className="size-4" />Agencies</a>
          <h1 className="font-semibold text-2xl tracking-tight">{showGoogleName ? liveName : agencyName(a)}</h1>
          <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
            {a.source === "sample" && <Badge variant="secondary">Fake sample</Badge>}
            {a.source === "manual" && <Badge variant="outline">Added by hand</Badge>}
            {a.source === "google" && <Badge variant="info">Google listing</Badge>}
            {showGoogleName && <span translate="no" className="text-xs [font-family:Roboto,Arial,sans-serif]">Google Maps</span>}
            {a.decision_maker_name && <span>{a.decision_maker_name}{a.decision_maker_title ? `, ${a.decision_maker_title}` : ""}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SimpleSelect label="Pipeline stage" value={a.pipeline_stage} onChange={(v) => void onStage(v)} className="w-44"
            items={STAGES.map((s) => { const I = STAGE_ICON[s]; return { value: s, label: STAGE_LABEL[s], icon: <I aria-hidden className="size-3.5" /> }; })} />
          <Button variant="outline" onClick={() => openQuickLog({ agencyId: id })}><PhoneIcon aria-hidden />Call</Button>
          <Button variant="outline" onClick={() => openQuickLog({ agencyId: id, channel: "email" })}><MailIcon aria-hidden />Email</Button>
          <Button variant="outline" onClick={() => { selectTab("tasks"); setFocusNewTask(true); }}><ListPlusIcon aria-hidden />Task</Button>
          <Menu>
            <MenuTrigger render={<Button variant="outline" size="icon" aria-label="More actions" />}><MoreHorizontalIcon aria-hidden /></MenuTrigger>
            <MenuPopup align="end">
              <MenuItem render={<a href="/api/export/my-data.json" download />}>Export my notes (JSON)</MenuItem>
              <MenuSeparator />
              <MenuItem variant="destructive" onClick={() => setConfirmDelete(true)}><Trash2Icon aria-hidden />Delete agency…</MenuItem>
            </MenuPopup>
          </Menu>
        </div>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Tabs value={tab} onValueChange={(v) => selectTab(v as Tab)} className="min-w-0">
          <TabsList variant="underline" className="mb-5 w-full justify-start overflow-x-auto *:data-[slot=tabs-tab]:grow-0 *:data-[slot=tabs-tab]:px-3" aria-label="Agency sections">
            <TabsTab value="overview">Overview</TabsTab>
            <TabsTab value="research"><SparklesIcon aria-hidden />Research</TabsTab>
            <TabsTab value="calls">Calls {data.calls.length > 0 && <span className="text-muted-foreground text-xs tabular-nums">{data.calls.length}</span>}</TabsTab>
            <TabsTab value="tasks">Tasks {openTasks > 0 && <span className="text-muted-foreground text-xs tabular-nums">{openTasks}</span>}</TabsTab>
            <TabsTab value="notes">Notes</TabsTab>
          </TabsList>
          <TabsPanel value="overview" keepMounted>
            <OverviewTab agency={a} onPatched={patchLocal} onLivePlace={(p: LivePlace) => setLiveName(p.name)} />
          </TabsPanel>
          <TabsPanel value="research">
            <Card>
              <EmptyState icon={SparklesIcon} title="Deep Research is coming in the next step"
                description="Stage 1.5b adds a per-agency research run: it reads the agency's own website (pages you confirm), and shows a fit score with quoted sources you can accept into your notes. Nothing is applied automatically."
                action={<Button variant="outline" onClick={() => selectTab("overview")}>Back to overview</Button>} />
            </Card>
          </TabsPanel>
          <TabsPanel value="calls"><CallsTab agencyId={id} calls={data.calls} /></TabsPanel>
          <TabsPanel value="tasks"><TasksTab agencyId={id} tasks={data.tasks} demos={data.demos} focusNew={tab === "tasks" && focusNewTask} /></TabsPanel>
          <TabsPanel value="notes"><NotesTab agency={a} onPatched={patchLocal} /></TabsPanel>
        </Tabs>
        <aside aria-label="Activity" className="xl:sticky xl:top-6"><ActivityTimeline agencyId={id} /></aside>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this agency?</AlertDialogTitle>
            <AlertDialogDescription>"{agencyName(a)}" and all its calls, tasks and demos will be deleted. You can undo for 5 seconds.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="ghost" />}>Cancel</AlertDialogClose>
            <Button variant="destructive" onClick={deleteAgency}>Delete</Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  );
}

function AgencySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading agency" className="space-y-5">
      <div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-8 w-80" /><Skeleton className="h-5 w-48" /></div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]"><Skeleton className="h-96 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>
    </div>
  );
}
