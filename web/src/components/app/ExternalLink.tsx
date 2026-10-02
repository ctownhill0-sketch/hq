import { ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";
import { safeHttpUrl } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Untrusted URLs (Google, websites, your notes) render as links only if http(s). */
export function ExternalLink({ href, children, className, icon = true }: { href: string | null | undefined; children: ReactNode; className?: string; icon?: boolean }) {
  const url = safeHttpUrl(href);
  if (!url) return <span className="text-muted-foreground">{children}</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer nofollow" className={cn("inline-flex items-center gap-1 text-accent-text underline-offset-2 hover:underline", className)}>
      {children}
      {icon && <ExternalLinkIcon aria-hidden className="size-3 opacity-70" />}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
