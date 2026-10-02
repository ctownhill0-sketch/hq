// Toast helpers on top of the coss ui toast manager.
import { toastManager } from "@/components/ui/toast";

export function notify(title: string, opts: { description?: string; type?: "success" | "info" | "warning" | "error"; action?: { label: string; onClick: () => void }; timeout?: number } = {}): void {
  toastManager.add({
    title,
    description: opts.description,
    type: opts.type ?? "success",
    timeout: opts.timeout ?? (opts.action ? 6000 : opts.type === "error" ? 8000 : 3000),
    actionProps: opts.action ? { children: opts.action.label, onClick: opts.action.onClick } : undefined,
  });
}

export function notifyError(message: string, title = "Something went wrong"): void {
  notify(title, { description: message, type: "error" });
}

/**
 * Deferred destructive action with Undo. The item disappears immediately; the
 * DELETE request is only sent when the undo window closes (or the page is
 * left). Undo restores it and nothing is ever sent.
 */
export function withUndo(message: string, opts: { hide: () => void; restore: () => void; commit: () => Promise<unknown>; delay?: number }): void {
  const delay = opts.delay ?? 5000;
  let settled = false;
  const run = async () => {
    if (settled) return;
    settled = true;
    window.removeEventListener("pagehide", run);
    try { await opts.commit(); } catch (e) {
      opts.restore();
      notifyError((e as Error).message, "Could not delete");
    }
  };
  opts.hide();
  const timer = window.setTimeout(run, delay);
  window.addEventListener("pagehide", run);
  notify(message, {
    type: "info", timeout: delay,
    action: {
      label: "Undo",
      onClick: () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        window.removeEventListener("pagehide", run);
        opts.restore();
      },
    },
  });
}
