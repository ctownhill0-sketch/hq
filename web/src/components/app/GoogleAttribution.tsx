import type { LivePlace } from "@/lib/types";
import { safeHttpUrl } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * GOOGLE RULE 4 (see src/google/places.js): "Google Maps" text attribution,
 * shown unaltered wherever Google data appears, plus any attributions the API
 * returns. Never hidden, never restyled into illegibility.
 */
export function GoogleAttribution({ attributions = [], className }: { attributions?: LivePlace["attributions"]; className?: string }) {
  return (
    <p className={cn("flex flex-wrap items-center gap-1 text-muted-foreground text-xs", className)}>
      <span translate="no" className="font-medium [font-family:Roboto,Arial,sans-serif]">Google Maps</span>
      {attributions.length > 0 && (
        <span>
          · Data also from:{" "}
          {attributions.map((a, i) => {
            const href = safeHttpUrl(a.providerUri);
            return (
              <span key={`${a.provider}-${i}`}>
                {i > 0 && ", "}
                {href ? <a className="underline underline-offset-2" href={href} target="_blank" rel="noopener noreferrer nofollow">{a.provider}</a> : a.provider}
              </span>
            );
          })}
        </span>
      )}
    </p>
  );
}
