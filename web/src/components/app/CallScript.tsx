import { ChevronRightIcon, CopyIcon, MessageSquareTextIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DISCOVERY_QUESTIONS, OUTREACH } from "@/lib/constants";
import { notify, notifyError } from "@/lib/notify";

/** Collapsible call script: outreach message + the six discovery questions. */
export function CallScript({ name }: { name?: string | null }) {
  const text = name ? OUTREACH.replace("[Name]", name.split(" ")[0]) : OUTREACH;
  async function copy() {
    try { await navigator.clipboard.writeText(text); notify("Copied to clipboard"); } catch { notifyError("Select the text and copy it by hand.", "Copy failed"); }
  }
  return (
    <Card className="p-0">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-5 py-4 font-medium text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <ChevronRightIcon aria-hidden className="size-4 text-muted-foreground group-open:rotate-90" />
          <MessageSquareTextIcon aria-hidden className="size-4 text-muted-foreground" />
          Call script
          <span className="font-normal text-muted-foreground text-xs">outreach message + six discovery questions</span>
        </summary>
        <div className="space-y-4 px-5 pb-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium text-sm">Outreach message</h3>
            <Button size="xs" variant="outline" onClick={copy}><CopyIcon aria-hidden />Copy</Button>
          </div>
          <p className="rounded-lg border-primary border-s-2 bg-muted px-4 py-3 text-sm leading-relaxed">{text}</p>
          <h3 className="font-medium text-sm">Six discovery questions</h3>
          <ol className="list-decimal space-y-1.5 ps-5 text-sm">
            {DISCOVERY_QUESTIONS.map(([key, label, q]) => (
              <li key={key}><span className="font-medium">{label}:</span> {q}</li>
            ))}
          </ol>
          <p className="text-muted-foreground text-xs">You are learning about their process: no coverage advice, and never ask them to send client files. Nothing here is sent automatically.</p>
        </div>
      </details>
    </Card>
  );
}
