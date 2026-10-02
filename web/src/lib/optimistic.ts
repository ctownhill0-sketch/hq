// Optimistic update with rollback: apply the change locally first, send the
// request, and undo the local change (with a visible error) if it fails.
import { notifyError } from "./notify";

export async function optimistic<T>(opts: {
  apply: () => void;
  rollback: () => void;
  request: () => Promise<T>;
  errorTitle?: string;
}): Promise<{ ok: true; value: T } | { ok: false; error: Error }> {
  opts.apply();
  try {
    return { ok: true, value: await opts.request() };
  } catch (e) {
    opts.rollback();
    notifyError((e as Error).message, opts.errorTitle ?? "Change not saved");
    return { ok: false, error: e as Error };
  }
}
