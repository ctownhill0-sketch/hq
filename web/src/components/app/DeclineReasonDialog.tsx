import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

/** Asks why an agency declined. A reason is required; cancelling changes nothing. */
export function DeclineReasonDialog({ open, onSubmit, onCancel }: { open: boolean; onSubmit: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (open) { setReason(""); setError(null); } }, [open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) { setError("A decline reason is required."); ref.current?.focus(); return; }
    onSubmit(reason.trim());
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogPopup className="max-w-md" initialFocus={ref}>
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Why did they decline?</DialogTitle>
            <DialogDescription>Recorded on the agency and used later in the objections summary.</DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <Field invalid={Boolean(error)}>
              <FieldLabel>Decline reason (required)</FieldLabel>
              <Textarea
                ref={ref}
                name="decline_reason"
                value={reason}
                maxLength={2000}
                placeholder="e.g. Already uses a renewal tool; no budget this year"
                aria-invalid={Boolean(error)}
                onChange={(e) => { setReason(e.target.value); if (error) setError(null); }}
              />
              {error ? <FieldError match>{error}</FieldError> : <FieldDescription>One or two sentences is enough.</FieldDescription>}
            </Field>
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
            <Button type="submit">Mark declined</Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
