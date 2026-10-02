import { useId, type ReactNode } from "react";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/** Autosaving text field: keeps its own value; parent receives every change. */
export function AutoText({ label, name, defaultValue, onChange, invalid, multiline, rows = 2, maxLength, type = "text", placeholder, hint, className }: {
  label: string; name: string; defaultValue: string | null; onChange: (name: string, v: string, delay?: number) => void;
  invalid?: boolean; multiline?: boolean; rows?: number; maxLength?: number; type?: string; placeholder?: string; hint?: ReactNode; className?: string;
}) {
  const id = useId();
  return (
    <Field className={className} invalid={invalid}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {multiline ? (
        <Textarea id={id} name={name} rows={rows} maxLength={maxLength} placeholder={placeholder} defaultValue={defaultValue ?? ""} aria-invalid={invalid || undefined}
          onChange={(e) => onChange(name, e.target.value)} onBlur={(e) => onChange(name, e.target.value, 0)} />
      ) : (
        <Input id={id} name={name} type={type} maxLength={maxLength} placeholder={placeholder} defaultValue={defaultValue ?? ""} aria-invalid={invalid || undefined}
          onChange={(e) => onChange(name, e.target.value)} onBlur={(e) => onChange(name, e.target.value, 0)} />
      )}
      {hint && <FieldDescription>{hint}</FieldDescription>}
    </Field>
  );
}
