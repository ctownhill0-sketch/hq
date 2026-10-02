import { MailIcon, PhoneIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/app/AppProvider";
import { EmptyState } from "@/components/app/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { CHANNEL_LABEL, DISCOVERY_QUESTIONS, OUTCOME_LABEL } from "@/lib/constants";
import { notifyChange } from "@/lib/events";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { withUndo } from "@/lib/notify";
import type { Call } from "@/lib/types";

export function CallsTab({ agencyId, calls }: { agencyId: number; calls: Call[] }) {
  const { openQuickLog } = useApp();
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const visible = calls.filter((c) => !hidden.has(c.id));
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="flex items-center gap-2 text-base"><PhoneIcon aria-hidden className="size-4 text-muted-foreground" />Call log</CardTitle>
        <CardAction className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => openQuickLog({ agencyId, channel: "email" })}><MailIcon aria-hidden />Log email</Button>
          <Button size="sm" onClick={() => openQuickLog({ agencyId })} data-new><PhoneIcon aria-hidden />Log call</Button>
        </CardAction>
      </CardHeader>
      {visible.length === 0 ? (
        <EmptyState icon={PhoneIcon} title="No calls yet" description="Open the call script on the Overview tab, make the call, then log what happened."
          action={<Button onClick={() => openQuickLog({ agencyId })}><PhoneIcon aria-hidden />Log a call</Button>} />
      ) : (
        <ol className="divide-y">
          {visible.map((c) => {
            const answered = DISCOVERY_QUESTIONS.filter(([k]) => c[k]);
            const positive = c.outcome === "conversation" || c.outcome === "meeting_booked";
            return (
              <li key={c.id} className="space-y-2 px-5 py-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium tabular-nums">{fmtDateTime(c.contacted_at)}</span>
                  <Badge variant="outline">{c.channel === "email" ? <MailIcon aria-hidden /> : <PhoneIcon aria-hidden />}{CHANNEL_LABEL[c.channel]}</Badge>
                  <Badge variant={positive ? "success" : c.outcome === "not_interested" ? "error" : "secondary"}>{OUTCOME_LABEL[c.outcome]}</Badge>
                  {c.contact_person && <span className="text-muted-foreground">{c.contact_person}</span>}
                  <Button className="ms-auto" size="icon-xs" variant="ghost" aria-label="Delete this call record" onClick={() => withUndo("Call deleted", {
                    hide: () => setHidden((h) => new Set(h).add(c.id)),
                    restore: () => setHidden((h) => { const n = new Set(h); n.delete(c.id); return n; }),
                    commit: () => api(`/calls/${c.id}`, { method: "DELETE" }).then(() => notifyChange({ agencyId, kind: "call" })),
                  })}><Trash2Icon aria-hidden /></Button>
                </div>
                {c.notes && <p className="whitespace-pre-wrap text-sm">{c.notes}</p>}
                {answered.length > 0 && (
                  <dl className="grid gap-x-4 gap-y-1 rounded-lg bg-muted px-3 py-2.5 text-sm sm:grid-cols-[12rem_minmax(0,1fr)]">
                    {answered.map(([k, label]) => (
                      <div key={k} className="contents">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="whitespace-pre-wrap">{c[k]}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {c.next_action && <p className="text-muted-foreground text-sm">Next: {c.next_action}{c.next_action_date && <span className="tabular-nums"> · {fmtDate(c.next_action_date)}</span>}</p>}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
