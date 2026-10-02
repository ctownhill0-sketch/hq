import { HistoryIcon } from "lucide-react";
import { useEffect } from "react";
import { ErrorAlert } from "@/components/app/ErrorAlert";
import { Timeline, TimelineContent, TimelineDate, TimelineHeader, TimelineIndicator, TimelineItem, TimelineSeparator, TimelineTitle } from "@/components/reui/timeline";
import { Card, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/useApi";
import { CHANNEL_LABEL, OUTCOME_LABEL } from "@/lib/constants";
import { onChange } from "@/lib/events";
import { fmtDateTime } from "@/lib/format";
import type { Call, TimelineItem as Item } from "@/lib/types";

function title(it: Item): string {
  if (it.kind === "call") {
    const [ch, out] = it.title.split(": ");
    return `${CHANNEL_LABEL[ch as Call["channel"]] ?? "Call"}: ${OUTCOME_LABEL[out as Call["outcome"]] ?? out}`;
  }
  return it.title;
}

/** Everything that happened with this agency (ReUI Timeline). */
export function ActivityTimeline({ agencyId }: { agencyId: number }) {
  const { data, error, loading, reload } = useApi<{ items: Item[] }>(`/agencies/${agencyId}/timeline`);
  useEffect(() => onChange((d) => { if (!d.agencyId || d.agencyId === agencyId) void reload({ quiet: true }); }), [agencyId, reload]);
  const items = data?.items ?? [];
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4"><CardTitle className="flex items-center gap-2 text-base"><HistoryIcon aria-hidden className="size-4 text-muted-foreground" />Activity</CardTitle></CardHeader>
      <CardPanel className="py-5">
        {error ? <ErrorAlert error={error} onRetry={() => void reload()} /> : loading && !data ? (
          <div className="space-y-4" aria-busy="true" aria-label="Loading activity">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-9" />)}</div>
        ) : items.length === 0 ? <p className="text-muted-foreground text-sm">Nothing yet.</p> : (
          <Timeline value={items.length + 1} aria-label="Activity timeline" className="ps-6">
            {items.map((it, i) => (
              <TimelineItem key={`${it.kind}-${it.ref}-${i}`} step={i + 1}>
                <TimelineHeader>
                  <TimelineSeparator />
                  <TimelineDate className="tabular-nums">{fmtDateTime(it.at)}</TimelineDate>
                  <TimelineTitle className="text-sm">{title(it)}</TimelineTitle>
                  <TimelineIndicator />
                </TimelineHeader>
                {it.detail && it.kind !== "task" && <TimelineContent className="line-clamp-2 text-muted-foreground text-xs">{it.detail}</TimelineContent>}
              </TimelineItem>
            ))}
          </Timeline>
        )}
      </CardPanel>
    </Card>
  );
}
