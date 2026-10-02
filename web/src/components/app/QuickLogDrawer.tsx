import { ChevronRightIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Combobox, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxPopup } from "@/components/ui/combobox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Sheet, SheetDescription, SheetFooter, SheetHeader, SheetPanel, SheetPopup, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { agencyName } from "@/lib/agency";
import { api } from "@/lib/api";
import { CHANNEL_LABEL, DISCOVERY_QUESTIONS, OUTCOME_LABEL } from "@/lib/constants";
import { notifyChange } from "@/lib/events";
import { nowLocalMinutes, todayLocal } from "@/lib/format";
import { notify } from "@/lib/notify";
import type { Call } from "@/lib/types";
import { useApp } from "./AppProvider";
import { ErrorAlert } from "./ErrorAlert";
import { SimpleSelect } from "./SimpleSelect";

type AgencyOption = { value: number; label: string };

/**
 * Quick-log drawer, available from anywhere ("L" or the palette). Opens
 * instantly (used many times a day: no animation). Cmd/Ctrl+Enter saves.
 * A "next action" becomes a follow-up task. Nothing is ever sent to anyone.
 */
export function QuickLogDrawer() {
  const { quickLog, closeQuickLog, agencies } = useApp();
  const open = quickLog !== null;
  const options = useMemo<AgencyOption[]>(() => agencies
    .map((a) => ({ value: a.id, label: agencyName(a) }))
    .sort((a, b) => a.label.localeCompare(b.label)), [agencies]);

  const [agency, setAgency] = useState<AgencyOption | null>(null);
  const [when, setWhen] = useState(nowLocalMinutes());
  const [channel, setChannel] = useState<Call["channel"]>("call");
  const [outcome, setOutcome] = useState<Call["outcome"]>("no_answer");
  const [person, setPerson] = useState("");
  const [notes, setNotes] = useState("");
  const [discovery, setDiscovery] = useState<Record<string, string>>({});
  const [nextAction, setNextAction] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const agencyRef = useRef<HTMLInputElement>(null);

  // Reset each time it opens.
  useEffect(() => {
    if (!quickLog) return;
    const ch = quickLog.channel ?? "call";
    setAgency(options.find((o) => o.value === Number(quickLog.agencyId)) ?? null);
    setWhen(nowLocalMinutes()); setChannel(ch); setOutcome(ch === "email" ? "other" : "no_answer");
    setPerson(""); setNotes(""); setDiscovery({}); setNextAction(""); setNextDate(""); setError(null); setSaving(false);
  }, [quickLog]); // eslint-disable-line react-hooks/exhaustive-deps
  // If the agency list arrives after the drawer opened, fill the agency in then.
  useEffect(() => {
    if (quickLog?.agencyId && !agency) {
      const o = options.find((x) => x.value === Number(quickLog.agencyId));
      if (o) setAgency(o);
    }
  }, [options]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (saving) return;
    if (!agency) { setError("Choose an agency."); agencyRef.current?.focus(); return; }
    if (nextDate && !nextAction.trim()) { setError("Describe the next action when you set a date."); return; }
    setSaving(true); setError(null);
    try {
      await api(`/agencies/${agency.value}/calls`, {
        method: "POST",
        body: {
          contacted_at: when, channel, outcome, contact_person: person || null, notes: notes || null,
          next_action: nextAction || null, next_action_date: nextDate || null,
          discovery: Object.fromEntries(DISCOVERY_QUESTIONS.map(([k]) => [k, discovery[k] || null])),
        },
      });
      closeQuickLog();
      notify(nextAction ? "Call logged · follow-up task created" : "Call logged");
      notifyChange({ agencyId: agency.value, kind: "call" });
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) closeQuickLog(); }}>
      <SheetPopup instant side="right" className="max-w-lg" initialFocus={quickLog?.agencyId ? notesRef : agencyRef}>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => { e.preventDefault(); void save(); }}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void save(); } }}
        >
          <SheetHeader>
            <SheetTitle>{channel === "email" ? "Log an email" : "Log a call"}</SheetTitle>
            <SheetDescription>Records what happened. Nothing is sent to anyone.</SheetDescription>
          </SheetHeader>
          <SheetPanel className="space-y-4">
            <Field>
              <FieldLabel>Agency</FieldLabel>
              <Combobox items={options} value={agency} onValueChange={(v) => setAgency(v as AgencyOption | null)} itemToStringLabel={(o: unknown) => (o as AgencyOption).label}>
                <ComboboxInput ref={agencyRef} placeholder={options.length ? "Search your agencies…" : "No agencies yet"} aria-label="Agency" />
                <ComboboxPopup>
                  <ComboboxEmpty>No agency matches.</ComboboxEmpty>
                  <ComboboxList>{(o: AgencyOption) => <ComboboxItem key={o.value} value={o}>{o.label}</ComboboxItem>}</ComboboxList>
                </ComboboxPopup>
              </Combobox>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>When</FieldLabel>
                <Input type="datetime-local" value={when} required onChange={(e) => setWhen(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel>Channel</FieldLabel>
                <SimpleSelect label="Channel" value={channel} onChange={setChannel} items={Object.entries(CHANNEL_LABEL).map(([value, label]) => ({ value: value as Call["channel"], label }))} className="w-full" />
              </Field>
              <Field>
                <FieldLabel>Outcome</FieldLabel>
                <SimpleSelect label="Outcome" value={outcome} onChange={setOutcome} items={Object.entries(OUTCOME_LABEL).map(([value, label]) => ({ value: value as Call["outcome"], label }))} className="w-full" />
              </Field>
              <Field>
                <FieldLabel>Contact person</FieldLabel>
                <Input value={person} maxLength={120} autoComplete="off" onChange={(e) => setPerson(e.target.value)} />
              </Field>
            </div>
            <Field>
              <FieldLabel>Notes</FieldLabel>
              <Textarea ref={notesRef} value={notes} maxLength={10000} rows={4} placeholder="What happened? What did they say?" onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <details className="group rounded-lg border px-3 py-2">
              <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-sm [&::-webkit-details-marker]:hidden">
                <ChevronRightIcon aria-hidden className="size-4 text-muted-foreground group-open:rotate-90" />
                Discovery answers (six questions)
              </summary>
              <div className="mt-3 space-y-3">
                {DISCOVERY_QUESTIONS.map(([key, label, q]) => (
                  <Field key={key}>
                    <FieldLabel>{label}</FieldLabel>
                    <Textarea rows={2} maxLength={4000} placeholder={q} value={discovery[key] ?? ""} onChange={(e) => setDiscovery((d) => ({ ...d, [key]: e.target.value }))} />
                  </Field>
                ))}
              </div>
            </details>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <Field>
                <FieldLabel>Next action</FieldLabel>
                <Input value={nextAction} maxLength={300} placeholder="e.g. Send demo invite" onChange={(e) => setNextAction(e.target.value)} />
                <FieldDescription>Creates a follow-up task.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Due</FieldLabel>
                <Input type="date" value={nextDate} min={todayLocal()} onChange={(e) => setNextDate(e.target.value)} />
              </Field>
            </div>
            {error && <ErrorAlert error={error} title="Not saved" />}
          </SheetPanel>
          <SheetFooter>
            <Button type="submit" loading={saving}>
              Save
              <KbdGroup className="ms-1 hidden sm:inline-flex"><Kbd>⌘</Kbd><Kbd>↵</Kbd></KbdGroup>
            </Button>
          </SheetFooter>
        </form>
      </SheetPopup>
    </Sheet>
  );
}
