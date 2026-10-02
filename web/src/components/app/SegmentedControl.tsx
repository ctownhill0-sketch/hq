import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import type { ReactNode } from "react";
import { segmentedControlItemVariants, segmentedControlRootClassName } from "@/lib/segmented-control";
import { cn } from "@/lib/utils";

/** coss "segmented control" pattern on a Radio Group (choose one value). */
export function SegmentedControl<T extends string>({ value, onChange, options, label, size = "sm", className }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: ReactNode; iconOnly?: boolean }[];
  label: string;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  return (
    <RadioGroup aria-label={label} value={value} onValueChange={(v) => onChange(v as T)} className={cn(segmentedControlRootClassName, className)}>
      {options.map((o) => (
        <Radio.Root
          key={o.value}
          value={o.value}
          aria-label={o.iconOnly ? o.label : undefined}
          title={o.iconOnly ? o.label : undefined}
          className={cn(segmentedControlItemVariants({ size, state: "checked" }))}
        >
          {o.icon}
          {!o.iconOnly && o.label}
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}
