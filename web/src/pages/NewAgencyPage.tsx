import { CircleAlertIcon, PlusIcon } from "lucide-react";
import { useRef, useState } from "react";
import { ErrorAlert } from "@/components/app/ErrorAlert";
import { PageHeader } from "@/components/app/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardPanel } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { notifyChange } from "@/lib/events";
import { notify } from "@/lib/notify";
import { navigate } from "@/lib/router";

/** Agencies you found yourself: everything typed here is your own data. */
export function NewAgencyPage() {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setNameError("Enter the agency's name."); nameRef.current?.focus(); return; }
    setSaving(true); setError(null);
    try {
      const r = await api<{ id: number }>("/agencies/manual", { method: "POST", body: { manual_name: name.trim(), manual_website: website.trim() || null, manual_phone: phone.trim() || null } });
      notify("Agency added");
      notifyChange({ kind: "create" });
      navigate(`/agency/${r.id}`);
    } catch (x) { setError((x as Error).message); setSaving(false); }
  }

  return (
    <>
      <PageHeader title="Add an agency by hand" description="For agencies you found yourself: referrals, directories, events." />
      <div className="max-w-2xl space-y-4">
        <Alert variant="info"><CircleAlertIcon aria-hidden /><AlertDescription>Type the details yourself. Don't copy them from Google Maps; use Find agencies for Google listings.</AlertDescription></Alert>
        <Card className="gap-0 py-0">
          <Form onSubmit={submit} className="gap-0" noValidate>
            <CardPanel className="grid gap-4 py-5 sm:grid-cols-2">
              <Field className="sm:col-span-2" invalid={Boolean(nameError)}>
                <FieldLabel>Agency name</FieldLabel>
                <Input ref={nameRef} autoFocus value={name} maxLength={200} autoComplete="off" placeholder="e.g. Keystone Property Insurance" onChange={(e) => { setName(e.target.value); setNameError(null); }} />
                {nameError && <FieldError match>{nameError}</FieldError>}
              </Field>
              <Field>
                <FieldLabel>Website</FieldLabel>
                <Input type="url" value={website} maxLength={2000} placeholder="https://…" onChange={(e) => setWebsite(e.target.value)} />
                <FieldDescription>Used later to prefill Deep Research.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Phone</FieldLabel>
                <Input type="tel" value={phone} maxLength={40} onChange={(e) => setPhone(e.target.value)} />
              </Field>
              {error && <div className="sm:col-span-2"><ErrorAlert error={error} title="Not saved" /></div>}
            </CardPanel>
            <CardFooter className="flex justify-end gap-2 border-t py-3">
              <Button variant="ghost" render={<a href="#/agencies" />}>Cancel</Button>
              <Button type="submit" loading={saving}><PlusIcon aria-hidden />Add agency</Button>
            </CardFooter>
          </Form>
        </Card>
      </div>
    </>
  );
}
