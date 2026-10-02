import { CheckCircle2Icon, NotebookPenIcon } from "lucide-react";
import { CallScript } from "@/components/app/CallScript";
import { ExternalLink } from "@/components/app/ExternalLink";
import { SaveIndicator } from "@/components/app/SaveIndicator";
import { SimpleSelect } from "@/components/app/SimpleSelect";
import { Card, CardAction, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { useAutosave } from "@/hooks/useAutosave";
import { api } from "@/lib/api";
import { APARTMENTS_LABEL } from "@/lib/constants";
import { notifyChange } from "@/lib/events";
import type { Agency, Apartments, LivePlace } from "@/lib/types";
import { AutoText } from "./fields";
import { GoogleCard } from "./GoogleCard";
import { useState } from "react";

export function OverviewTab({ agency, onPatched, onLivePlace }: { agency: Agency; onPatched: (patch: Partial<Agency>) => void; onLivePlace: (p: LivePlace) => void }) {
  const save = async (patch: Record<string, unknown>) => {
    // Only YOUR fields are sent; nothing from the live Google card is ever included.
    await api(`/agencies/${agency.id}`, { method: "PATCH", body: patch });
    onPatched(patch as Partial<Agency>);
    notifyChange({ agencyId: agency.id, kind: "edit" });
  };
  return (
    <div className="space-y-5">
      {agency.source === "google" && agency.place_id
        ? <GoogleCard agencyId={agency.id} placeId={agency.place_id} onLoaded={onLivePlace} />
        : <OwnDataCard agency={agency} save={save} />}
      <QualificationCard agency={agency} save={save} />
      <CallScript name={agency.decision_maker_name} />
    </div>
  );
}

function OwnDataCard({ agency, save }: { agency: Agency; save: (p: Record<string, unknown>) => Promise<void> }) {
  const a = useAutosave(save);
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-3">
        <CardTitle className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs"><NotebookPenIcon aria-hidden className="size-3.5" />{agency.source === "sample" ? "Fictional sample data" : "Your own data · added by hand"}</CardTitle>
        <CardAction><SaveIndicator state={a.state} /></CardAction>
      </CardHeader>
      <CardPanel className="grid gap-4 py-4 sm:grid-cols-2">
        <AutoText className="sm:col-span-2" label="Agency name" name="manual_name" defaultValue={agency.manual_name} maxLength={200} onChange={a.change} invalid={a.invalid.manual_name} />
        <AutoText label="Website" name="manual_website" type="url" placeholder="https://…" defaultValue={agency.manual_website} onChange={a.change} invalid={a.invalid.manual_website}
          hint={agency.manual_website ? <ExternalLink href={agency.manual_website}>Open website</ExternalLink> : undefined} />
        <AutoText label="Phone" name="manual_phone" type="tel" maxLength={40} defaultValue={agency.manual_phone} onChange={a.change} invalid={a.invalid.manual_phone} />
      </CardPanel>
    </Card>
  );
}

function QualificationCard({ agency, save }: { agency: Agency; save: (p: Record<string, unknown>) => Promise<void> }) {
  const a = useAutosave(save);
  const [apt, setApt] = useState<Apartments>(agency.handles_apartments);
  const [perm, setPerm] = useState(Boolean(agency.permission_to_use_sample));
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="flex items-center gap-2 text-base"><CheckCircle2Icon aria-hidden className="size-4 text-muted-foreground" />Qualification</CardTitle>
        <CardAction><SaveIndicator state={a.state} /></CardAction>
      </CardHeader>
      <CardPanel className="grid gap-4 py-5 sm:grid-cols-6">
        <Field className="sm:col-span-2">
          <FieldLabel>Handles apartments?</FieldLabel>
          <SimpleSelect label="Handles apartments?" value={apt} className="w-full"
            onChange={(v) => { setApt(v); a.change("handles_apartments", v, 0); }}
            items={(Object.keys(APARTMENTS_LABEL) as Apartments[]).map((v) => ({ value: v, label: APARTMENTS_LABEL[v] }))} />
        </Field>
        <AutoText className="sm:col-span-4" label="Apartment evidence link" name="apartment_evidence_url" type="url" placeholder="https://…" defaultValue={agency.apartment_evidence_url} onChange={a.change} invalid={a.invalid.apartment_evidence_url}
          hint={agency.apartment_evidence_url ? <ExternalLink href={agency.apartment_evidence_url}>Open evidence</ExternalLink> : undefined} />
        <AutoText className="sm:col-span-6" label="Evidence note" name="apartment_evidence_note" maxLength={2000} defaultValue={agency.apartment_evidence_note} onChange={a.change} />
        <AutoText className="sm:col-span-3" label="Decision maker" name="decision_maker_name" maxLength={120} defaultValue={agency.decision_maker_name} onChange={a.change} />
        <AutoText className="sm:col-span-3" label="Title" name="decision_maker_title" maxLength={120} defaultValue={agency.decision_maker_title} onChange={a.change} />
        <AutoText className="sm:col-span-6" label="Contact route" name="contact_route_note" maxLength={2000} placeholder="e.g. front desk, ask for Pat" defaultValue={agency.contact_route_note} onChange={a.change} />
        <AutoText className="sm:col-span-3" label="Current system" name="current_system" multiline maxLength={2000} defaultValue={agency.current_system} onChange={a.change} />
        <AutoText className="sm:col-span-3" label="Problem they described" name="problem_described" multiline maxLength={4000} defaultValue={agency.problem_described} onChange={a.change} />
        {agency.source === "google" && (
          <AutoText className="sm:col-span-6" label="Your label" name="label" maxLength={120} placeholder="Your short name for lists" defaultValue={agency.label} onChange={a.change}
            hint="Typed by you and shown in lists. Not copied from Google." />
        )}
        {(agency.pipeline_stage === "declined" || agency.decline_reason) && (
          <AutoText className="sm:col-span-6" label="Decline reason" name="decline_reason" multiline maxLength={2000} defaultValue={agency.decline_reason} onChange={a.change} invalid={a.invalid.decline_reason} />
        )}
        <Label className="flex items-center gap-2 font-normal sm:col-span-6">
          <Checkbox checked={perm} onCheckedChange={(c) => { setPerm(Boolean(c)); a.change("permission_to_use_sample", Boolean(c), 0); }} />
          They gave permission to use a sample of their (non-client) material
        </Label>
      </CardPanel>
    </Card>
  );
}
