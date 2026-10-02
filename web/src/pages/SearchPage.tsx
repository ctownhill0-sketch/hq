import { CheckIcon, CircleAlertIcon, LinkIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorAlert } from "@/components/app/ErrorAlert";
import { ExternalLink } from "@/components/app/ExternalLink";
import { GoogleAttribution } from "@/components/app/GoogleAttribution";
import { PageHeader } from "@/components/app/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api";
import { notifyChange } from "@/lib/events";
import { hostOf } from "@/lib/format";
import { notify, notifyError } from "@/lib/notify";
import { navigate } from "@/lib/router";
import type { LivePlace } from "@/lib/types";

/**
 * Find agencies with Google Places Text Search.
 * GOOGLE RULE 2: results are shown only; "Save" sends the place ID alone.
 * GOOGLE RULE 3: there is deliberately no export/download of results here.
 * GOOGLE RULE 4: attribution is shown with the results.
 */
export function SearchPage({ query }: { query: URLSearchParams }) {
  const relinkId = /^\d+$/.test(query.get("relink") ?? "") ? Number(query.get("relink")) : null;
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [city, setCity] = useState(() => sessionStorage.getItem("hq.city") ?? "");
  const [q, setQ] = useState(() => sessionStorage.getItem("hq.query") ?? "insurance agency apartment");
  const [results, setResults] = useState<LivePlace[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const cityRef = useRef<HTMLInputElement>(null);

  useEffect(() => { api<{ googleEnabled: boolean }>("/status").then((s) => setEnabled(s.googleEnabled)).catch((e) => setError(e)); }, []);
  useEffect(() => { if (enabled && !city) cityRef.current?.focus(); }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!city.trim() || !q.trim()) return;
    sessionStorage.setItem("hq.city", city.trim());
    sessionStorage.setItem("hq.query", q.trim());
    setBusy(true); setError(null);
    try {
      const r = await api<{ results: LivePlace[] }>("/places/search", { method: "POST", body: { city: city.trim(), query: q.trim() } });
      setResults(r.results);
    } catch (x) { setError(x as Error); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title={relinkId ? "Relink to a current listing" : "Find agencies"}
        description="Search Google Places for agencies that handle apartment insurance. Saving stores the place ID only." />
      {enabled === false ? (
        <Card>
          <CardPanel className="space-y-4 py-6">
            <Alert variant="info"><CircleAlertIcon aria-hidden /><AlertTitle>Google search is off because no API key is set</AlertTitle>
              <AlertDescription>
                <ol className="mt-1 list-decimal space-y-1 ps-5">
                  <li>Create a key restricted to "Places API (New)" (README, "Google Cloud setup").</li>
                  <li>Copy .env.example to .env in the project folder.</li>
                  <li>Paste the key after GOOGLE_PLACES_API_KEY= in .env. Never paste it into chat or the browser.</li>
                  <li>Restart the server (Ctrl+C, then npm start).</li>
                </ol>
              </AlertDescription>
            </Alert>
            <div className="flex flex-wrap gap-2">
              <Button render={<a href="#/agencies/new" />}><PlusIcon aria-hidden />Add an agency by hand</Button>
              <Button variant="outline" render={<a href="#/agencies" />}>Try the fake sample agencies</Button>
            </div>
          </CardPanel>
        </Card>
      ) : (
        <div className="space-y-5">
          {relinkId && (
            <Alert variant="warning"><CircleAlertIcon aria-hidden /><AlertTitle>Relinking agency #{relinkId}</AlertTitle>
              <AlertDescription>Its saved Google listing is no longer available. Search again and choose "Use this listing". Your notes and calls stay attached.</AlertDescription></Alert>
          )}
          <Card className="py-4">
            <CardPanel>
              <form onSubmit={search} role="search" className="flex flex-wrap items-end gap-3">
                <Field className="min-w-48 flex-1"><FieldLabel>City</FieldLabel><Input ref={cityRef} value={city} required maxLength={100} autoComplete="off" placeholder="e.g. Philadelphia, PA" onChange={(e) => setCity(e.target.value)} /></Field>
                <Field className="min-w-60 flex-[2]"><FieldLabel>What to search</FieldLabel><Input data-search value={q} required maxLength={150} placeholder="e.g. apartment insurance agency" onChange={(e) => setQ(e.target.value)} /></Field>
                <Button type="submit" loading={busy} disabled={enabled === null}><SearchIcon aria-hidden />Search</Button>
              </form>
              <p className="mt-2 text-muted-foreground text-xs">Each search uses 1 Google call (counted in the sidebar). Results are shown, not stored.</p>
            </CardPanel>
          </Card>
          {error && <ErrorAlert error={error} />}
          {busy ? (
            <Card className="gap-0 py-0" aria-busy="true" aria-label="Searching">{[0, 1, 2].map((i) => <div key={i} className="space-y-2 border-b px-5 py-4 last:border-0"><Skeleton className="h-5 w-2/5" /><Skeleton className="h-4 w-3/5" /></div>)}</Card>
          ) : results && (results.length === 0 ? (
            <Card><EmptyState icon={SearchIcon} title="No results" description='Try a nearby city or different wording, e.g. "commercial property insurance".' /><CardPanel><GoogleAttribution /></CardPanel></Card>
          ) : (
            <Card className="gap-0 py-0" aria-label="Google results">
              <CardHeader className="border-b py-3">
                <CardTitle className="font-medium text-muted-foreground text-xs tabular-nums">{results.length} results from Google</CardTitle>
                <GoogleAttribution attributions={results.flatMap((p) => p.attributions)} />
              </CardHeader>
              <ul className="divide-y">{results.map((p) => <ResultRow key={p.id} place={p} relinkId={relinkId} />)}</ul>
              <div className="border-t px-5 py-3"><GoogleAttribution attributions={results.flatMap((p) => p.attributions)} /></div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function ResultRow({ place: p, relinkId }: { place: LivePlace; relinkId: number | null }) {
  const [state, setState] = useState<{ saving: boolean; savedId: number | null; already: boolean }>({ saving: false, savedId: null, already: false });
  async function act() {
    setState((s) => ({ ...s, saving: true }));
    try {
      if (relinkId) {
        await api(`/agencies/${relinkId}/place`, { method: "PUT", body: { place_id: p.id } });
        notify("Agency relinked");
        notifyChange({ agencyId: relinkId });
        navigate(`/agency/${relinkId}`);
        return;
      }
      // GOOGLE RULE 2: only the place ID is sent and stored.
      const r = await api<{ id: number }>("/agencies", { method: "POST", body: { place_id: p.id } });
      setState({ saving: false, savedId: r.id, already: false });
      notify("Saved (place ID only)");
      notifyChange({ kind: "save" });
    } catch (e) {
      const err = e as ApiError;
      const id = (err.data as { id?: number } | null)?.id;
      if (err.status === 409 && id) setState({ saving: false, savedId: id, already: true });
      else { setState((s) => ({ ...s, saving: false })); notifyError(err.message, "Not saved"); }
    }
  }
  return (
    <li className="flex flex-wrap items-start gap-3 px-5 py-4">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-center gap-2 font-medium text-sm">
          {p.name || "(no name)"}
          {p.businessStatus && p.businessStatus !== "OPERATIONAL" && <Badge variant="warning">{p.businessStatus.replace(/_/g, " ").toLowerCase()}</Badge>}
        </p>
        <p className="text-muted-foreground text-sm">{p.address}</p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {p.website ? <ExternalLink href={p.website}>{hostOf(p.website)}</ExternalLink> : <span className="text-muted-foreground">No website</span>}
          {p.mapsUrl && <ExternalLink href={p.mapsUrl}>View on Google Maps</ExternalLink>}
          {p.phone && <span className="text-muted-foreground tabular-nums">{p.phone}</span>}
        </p>
      </div>
      {state.savedId ? (
        <Button size="sm" variant="outline" render={<a href={`#/agency/${state.savedId}`} />}><CheckIcon aria-hidden />{state.already ? "Already saved · open" : "Saved · open"}</Button>
      ) : (
        <Button size="sm" variant={relinkId ? "default" : "outline"} loading={state.saving} onClick={() => void act()}>
          {relinkId ? <><LinkIcon aria-hidden />Use this listing</> : <><PlusIcon aria-hidden />Save</>}
        </Button>
      )}
    </li>
  );
}
