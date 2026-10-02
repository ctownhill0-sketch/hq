import type { ReactNode } from "react";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface Option<T extends string> { value: T; label: string; icon?: ReactNode }

/** Thin wrapper over the coss Select for the common value/label case. */
export function SimpleSelect<T extends string>({ value, onChange, items, label, id, className, size = "default", disabled }: {
  value: T;
  onChange: (v: T) => void;
  items: Option<T>[];
  label: string;
  id?: string;
  className?: string;
  size?: "sm" | "default" | "lg";
  disabled?: boolean;
}) {
  return (
    <Select items={items} value={value} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
      <SelectTrigger id={id} aria-label={label} size={size} className={cn("w-auto min-w-36", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectPopup>
        {items.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            <span className="flex items-center gap-2">{o.icon}{o.label}</span>
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}
