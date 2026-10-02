import { useEffect, useState } from "react";
import { Meter, MeterIndicator, MeterLabel, MeterTrack, MeterValue } from "@/components/ui/meter";
import { api } from "@/lib/api";
import type { GoogleUsage } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Google usage meter (research meters arrive in Stage 1.5b). */
export function UsageMeters({ compact = false }: { compact?: boolean }) {
  const [usage, setUsage] = useState<GoogleUsage | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api<{ googleEnabled: boolean; usage: GoogleUsage }>("/status")
      .then((s) => { setEnabled(s.googleEnabled); setUsage(s.usage); })
      .catch(() => setError(true));
    const h = (e: Event) => setUsage((u) => ({ ...(u as GoogleUsage), ...(e as CustomEvent<GoogleUsage>).detail }));
    window.addEventListener("hq:usage", h);
    return () => window.removeEventListener("hq:usage", h);
  }, []);

  // Every state is the same height (label row + gap + track) so nothing shifts.
  if (error) return <p className="h-6.5 text-muted-foreground text-xs">Usage unavailable</p>;
  if (!usage || enabled === null) return <div className="h-6.5" aria-hidden />;
  if (!enabled) return <p className="h-6.5 text-muted-foreground text-xs">Google search off (no API key)</p>;
  const pct = usage.perDay ? usage.usedToday / usage.perDay : 0;
  return (
    <Meter value={usage.usedToday} max={usage.perDay} className={cn("h-6.5 gap-1.5", compact && "sr-only")}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <MeterLabel className="font-normal text-muted-foreground text-xs">Google calls today</MeterLabel>
        <MeterValue className="text-xs">{() => `${usage.usedToday} / ${usage.perDay}`}</MeterValue>
      </div>
      <MeterTrack className="h-1 rounded-full">
        <MeterIndicator className={cn("rounded-full", pct >= 1 ? "bg-destructive" : pct >= 0.8 ? "bg-warning" : "bg-primary")} />
      </MeterTrack>
    </Meter>
  );
}
