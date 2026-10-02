// Pipeline stage changes: optimistic, with rollback on failure, an Undo toast,
// and a REQUIRED reason when moving to "declined".
import { api } from "./api";
import { STAGE_LABEL } from "./constants";
import { notifyChange } from "./events";
import { notify } from "./notify";
import { optimistic } from "./optimistic";
import type { Stage } from "./types";

export interface StageChangeRequest {
  id: number;
  from: Stage;
  to: Stage;
  /** Existing reason on the agency, if any. */
  currentReason?: string | null;
  /** Ask the user for a decline reason; resolve null if they cancel. */
  askReason: () => Promise<string | null>;
  apply: (stage: Stage) => void;
  rollback: (stage: Stage) => void;
  withUndo?: boolean;
  request?: typeof api;
}

/** Returns true if the stage changed. Declined without a reason never sends a request. */
export async function changeStage(r: StageChangeRequest): Promise<boolean> {
  if (r.from === r.to) return false;
  const body: { pipeline_stage: Stage; decline_reason?: string } = { pipeline_stage: r.to };
  if (r.to === "declined") {
    const reason = r.currentReason?.trim() ? r.currentReason : await r.askReason();
    if (!reason || !reason.trim()) return false;
    if (!r.currentReason?.trim()) body.decline_reason = reason.trim();
  }
  const send = r.request ?? api;
  const res = await optimistic({
    apply: () => r.apply(r.to),
    rollback: () => r.rollback(r.from),
    request: () => send(`/agencies/${r.id}`, { method: "PATCH", body }),
    errorTitle: "Stage not changed",
  });
  if (!res.ok) return false;
  notifyChange({ agencyId: r.id, kind: "stage" });
  if (r.to === "paid_pilot") {
    // The one rare-moment delight: a paid pilot is a milestone.
    notify("Paid pilot logged 🎉", { description: "That's real revenue in the pipeline. Nice work.", type: "success" });
  } else if (r.withUndo !== false) {
    notify(`Stage: ${STAGE_LABEL[r.to]}`, {
      type: "info",
      action: {
        label: "Undo",
        onClick: () => void changeStage({ ...r, from: r.to, to: r.from, currentReason: "kept", withUndo: false }),
      },
    });
  }
  return true;
}
