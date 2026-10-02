import { CircleAlertIcon, RotateCwIcon } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Visible failure state: errors are never silent. */
export function ErrorAlert({ error, onRetry, title = "Something went wrong" }: { error: Error | string; onRetry?: () => void; title?: string }) {
  return (
    <Alert variant="error" role="alert">
      <CircleAlertIcon aria-hidden />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{typeof error === "string" ? error : error.message}</AlertDescription>
      {onRetry && (
        <AlertAction>
          <Button size="sm" variant="outline" onClick={onRetry}><RotateCwIcon aria-hidden />Retry</Button>
        </AlertAction>
      )}
    </Alert>
  );
}
