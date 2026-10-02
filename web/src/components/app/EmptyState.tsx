import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

/** Empty states always name the next action. */
export function EmptyState({ icon: Icon, title, description, action, className }: { icon: LucideIcon; title: string; description: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <Empty className={className}>
      <EmptyHeader>
        <EmptyMedia variant="icon"><Icon aria-hidden /></EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}
