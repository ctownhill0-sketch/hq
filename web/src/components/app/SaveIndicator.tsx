import { CheckIcon, CircleAlertIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveState = { status: "idle" | "saving" | "saved" | "error"; message?: string };

/** Visible "Saving… / Saved / Not saved" indicator for autosaved fields. */
export function SaveIndicator({ state, className }: { state: SaveState; className?: string }) {
  return (
    <span role="status" aria-live="polite" className={cn("inline-flex min-w-16 items-center gap-1 text-xs tabular-nums", className,
      state.status === "saved" && "text-success-foreground",
      state.status === "error" && "text-destructive-foreground",
      state.status === "saving" && "text-muted-foreground")}>
      {state.status === "saving" && "Saving…"}
      {state.status === "saved" && <><CheckIcon aria-hidden className="size-3.5" />Saved</>}
      {state.status === "error" && <><CircleAlertIcon aria-hidden className="size-3.5" />{state.message ? `Not saved: ${state.message}` : "Not saved"}</>}
    </span>
  );
}
