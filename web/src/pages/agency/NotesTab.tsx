import { NotebookPenIcon } from "lucide-react";
import { SaveIndicator } from "@/components/app/SaveIndicator";
import { Card, CardAction, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAutosave } from "@/hooks/useAutosave";
import { api } from "@/lib/api";
import type { Agency } from "@/lib/types";

export function NotesTab({ agency, onPatched }: { agency: Agency; onPatched: (p: Partial<Agency>) => void }) {
  const a = useAutosave(async (patch) => { await api(`/agencies/${agency.id}`, { method: "PATCH", body: patch }); onPatched(patch as Partial<Agency>); });
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="flex items-center gap-2 text-base"><NotebookPenIcon aria-hidden className="size-4 text-muted-foreground" />Notes</CardTitle>
        <CardAction><SaveIndicator state={a.state} /></CardAction>
      </CardHeader>
      <CardPanel className="space-y-2 py-4">
        <Textarea aria-label="Notes" rows={16} maxLength={10000} defaultValue={agency.notes ?? ""} placeholder="Anything worth remembering about this agency…"
          onChange={(e) => a.change("notes", e.target.value)} onBlur={(e) => a.change("notes", e.target.value, 0)} aria-invalid={a.invalid.notes || undefined} data-new />
        <p className="text-muted-foreground text-xs">Saves automatically as you type.</p>
      </CardPanel>
    </Card>
  );
}
