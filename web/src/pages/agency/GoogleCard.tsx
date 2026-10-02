import { CircleAlertIcon, MapPinIcon, RotateCwIcon, SearchIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink } from "@/components/app/ExternalLink";
import { GoogleAttribution } from "@/components/app/GoogleAttribution";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { ApiError, api } from "@/lib/api";
import { hostOf } from "@/lib/format";
import type { LivePlace } from "@/lib/types";

/**
 * Live Google details.
 * GOOGLE RULE 2: fetched live when you open the agency, displayed, never stored
 *   (nothing here is written to state that is persisted or sent back).
 * GOOGLE RULE 4: "Google Maps" attribution is shown with the data.
 * GOOGLE RULE 5: NOT_FOUND shows "Listing no longer available" and a relink path.
 */
export function GoogleCard({ agencyId, placeId, onLoaded }: { agencyId: number; placeId: string; onLoaded?: (p: LivePlace) => void }) {
  const [place, setPlace] = useState<LivePlace | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await api<{ place: LivePlace }>(`/places/${encodeURIComponent(placeId)}`);
      setPlace(r.place);
      onLoaded?.(r.place);
    } catch (e) { setError(e as Error); } finally { setLoading(false); }
  }, [placeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);
  const code = error instanceof ApiError ? error.code : null;

  return (
    <Card className="gap-0 border-s-2 border-s-[#4285f4] py-0" aria-label="Live Google details">
      <CardHeader className="border-b py-3">
        <CardTitle className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs"><MapPinIcon aria-hidden className="size-3.5" />Live from Google · not stored</CardTitle>
        <CardAction>
          <Tooltip>
            <TooltipTrigger render={<Button size="icon-xs" variant="ghost" aria-label="Reload live details (uses 1 Google call)" onClick={() => void load()} disabled={loading} />}>
              <RotateCwIcon aria-hidden />
            </TooltipTrigger>
            <TooltipPopup>Reload (uses 1 Google call)</TooltipPopup>
          </Tooltip>
        </CardAction>
      </CardHeader>
      <CardPanel className="py-4">
        {loading ? (
          <div className="space-y-2.5" aria-busy="true" aria-label="Loading live details">
            <Skeleton className="h-6 w-1/2" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-4 w-2/5" /><Skeleton className="h-4 w-3/5" />
          </div>
        ) : code === "NOT_FOUND" ? (
          <Alert variant="warning">
            <CircleAlertIcon aria-hidden />
            <AlertTitle>Listing no longer available</AlertTitle>
            <AlertDescription>Google no longer recognises this saved place ID. The agency may have moved, closed or merged listings. Your notes are safe.</AlertDescription>
            <AlertAction><Button size="sm" variant="outline" render={<a href={`#/search?relink=${agencyId}`} />}><SearchIcon aria-hidden />Search again to relink</Button></AlertAction>
          </Alert>
        ) : code === "NO_KEY" ? (
          <Alert variant="info"><CircleAlertIcon aria-hidden /><AlertTitle>Live details are off</AlertTitle><AlertDescription>No Google API key in .env. Everything else on this page works.</AlertDescription></Alert>
        ) : error ? (
          <Alert variant="error">
            <CircleAlertIcon aria-hidden /><AlertTitle>Could not load Google details</AlertTitle><AlertDescription>{error.message}</AlertDescription>
            <AlertAction><Button size="sm" variant="outline" onClick={() => void load()}><RotateCwIcon aria-hidden />Retry</Button></AlertAction>
          </Alert>
        ) : place && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-lg">{place.name || "(no name)"}</h2>
              {place.businessStatus && place.businessStatus !== "OPERATIONAL" && <Badge variant="warning">{place.businessStatus.replace(/_/g, " ").toLowerCase()}</Badge>}
            </div>
            <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Address</dt><dd>{place.address || "-"}</dd>
              <dt className="text-muted-foreground">Phone</dt><dd className="tabular-nums">{place.phone || "-"}</dd>
              <dt className="text-muted-foreground">Website</dt><dd>{place.website ? <ExternalLink href={place.website}>{hostOf(place.website)}</ExternalLink> : "-"}</dd>
              <dt className="text-muted-foreground">Map</dt><dd>{place.mapsUrl ? <ExternalLink href={place.mapsUrl}>View on Google Maps</ExternalLink> : "-"}</dd>
            </dl>
            <GoogleAttribution attributions={place.attributions} />
          </div>
        )}
      </CardPanel>
    </Card>
  );
}
