import { BadgeCheckIcon, FileTextIcon, MessagesSquareIcon, PhoneOutgoingIcon, PresentationIcon, SearchIcon, XCircleIcon, type LucideIcon } from "lucide-react";
import { STAGE_LABEL } from "@/lib/constants";
import type { Stage } from "@/lib/types";
import { cn } from "@/lib/utils";

// Stage colour is always paired with an icon and a text label (never colour alone).
export const STAGE_ICON: Record<Stage, LucideIcon> = {
  researched: SearchIcon, contacted: PhoneOutgoingIcon, conversation: MessagesSquareIcon,
  demo: PresentationIcon, proposal: FileTextIcon, paid_pilot: BadgeCheckIcon, declined: XCircleIcon,
};

// Static class strings so Tailwind can see them.
export const STAGE_CLASS: Record<Stage, string> = {
  researched: "bg-[var(--stage-researched-bg)] text-[var(--stage-researched)]",
  contacted: "bg-[var(--stage-contacted-bg)] text-[var(--stage-contacted)]",
  conversation: "bg-[var(--stage-conversation-bg)] text-[var(--stage-conversation)]",
  demo: "bg-[var(--stage-demo-bg)] text-[var(--stage-demo)]",
  proposal: "bg-[var(--stage-proposal-bg)] text-[var(--stage-proposal)]",
  paid_pilot: "bg-[var(--stage-paid_pilot-bg)] text-[var(--stage-paid_pilot)]",
  declined: "bg-[var(--stage-declined-bg)] text-[var(--stage-declined)]",
};

export function StageBadge({ stage, className }: { stage: Stage; className?: string }) {
  const Icon = STAGE_ICON[stage];
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 font-medium text-xs", STAGE_CLASS[stage], className)}>
      <Icon aria-hidden className="size-3.5" />
      {STAGE_LABEL[stage]}
    </span>
  );
}

/** Solid fills for charts (always accompanied by a text legend). */
export const STAGE_FILL: Record<Stage, string> = {
  researched: "bg-[var(--stage-researched)]",
  contacted: "bg-[var(--stage-contacted)]",
  conversation: "bg-[var(--stage-conversation)]",
  demo: "bg-[var(--stage-demo)]",
  proposal: "bg-[var(--stage-proposal)]",
  paid_pilot: "bg-[var(--stage-paid_pilot)]",
  declined: "bg-[var(--stage-declined)]",
};
