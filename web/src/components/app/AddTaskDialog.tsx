import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Combobox, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxPopup } from "@/components/ui/combobox";
import { Dialog, DialogClose, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { agencyName } from "@/lib/agency";
import { api } from "@/lib/api";
import { notifyChange } from "@/lib/events";
import { todayLocal } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useApp } from "./AppProvider";

type Opt = { value: number; label: string };

export function AddTaskDialog({ open, onOpenChange, agencyId }: { open: boolean; onOpenChange: (o: boolean) => void; agencyId?: number }) {
  const { agencies } = useApp();
  const options = useMemo<Opt[]>(() => agencies.map((a) => ({ value: a.id, label: agencyName(a) })), [agencies]);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(todayLocal(1));
  const [agency, setAgency] = useState<Opt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(""); setDue(todayLocal(1)); setError(null); setSaving(false);
    setAgency(options.find((o) => o.value === agencyId) ?? null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Describe the task."); ref.current?.focus(); return; }
    setSaving(true);
    try {
      await api("/tasks", { method: "POST", body: { title: title.trim(), due_date: due || null, agency_id: agency?.value ?? null } });
      onOpenChange(false);
      notify("Task added");
      notifyChange({ agencyId: agency?.value, kind: "task" });
    } catch (x) { setError((x as Error).message); setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-md" initialFocus={ref}>
        <form onSubmit={submit} noValidate>
          <DialogHeader><DialogTitle>Add task</DialogTitle></DialogHeader>
          <DialogPanel className="space-y-4">
            <Field invalid={Boolean(error)}>
              <FieldLabel>Task</FieldLabel>
              <Input ref={ref} value={title} maxLength={300} placeholder="What needs doing?" onChange={(e) => { setTitle(e.target.value); setError(null); }} />
              {error && <FieldError match>{error}</FieldError>}
            </Field>
            <div className="grid grid-cols-[1fr_10rem] gap-3">
              <Field>
                <FieldLabel>Agency (optional)</FieldLabel>
                <Combobox items={options} value={agency} onValueChange={(v) => setAgency(v as Opt | null)} itemToStringLabel={(o: unknown) => (o as Opt).label}>
                  <ComboboxInput placeholder="No agency" aria-label="Agency" showClear />
                  <ComboboxPopup>
                    <ComboboxEmpty>No agency matches.</ComboboxEmpty>
                    <ComboboxList>{(o: Opt) => <ComboboxItem key={o.value} value={o}>{o.label}</ComboboxItem>}</ComboboxList>
                  </ComboboxPopup>
                </Combobox>
              </Field>
              <Field>
                <FieldLabel>Due</FieldLabel>
                <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              </Field>
            </div>
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
            <Button type="submit" loading={saving}>Add task</Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
