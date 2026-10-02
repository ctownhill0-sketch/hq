import { afterEach, describe, expect, it, vi } from "vitest";
import { resetCsrfForTests } from "@/lib/api";
import { optimistic } from "@/lib/optimistic";
import { changeStage } from "@/lib/stage";
import { mockApi } from "./fetchMock";

afterEach(() => { vi.unstubAllGlobals(); resetCsrfForTests(); });

describe("optimistic updates", () => {
  it("applies first, then rolls back when the request fails", async () => {
    let state = "open";
    const seen: string[] = [];
    const r = await optimistic({
      apply: () => { state = "done"; seen.push(state); },
      rollback: () => { state = "open"; seen.push(state); },
      request: async () => { throw new Error("Server said no"); },
    });
    expect(r.ok).toBe(false);
    expect(seen).toEqual(["done", "open"]);
    expect(state).toBe("open");
  });

  it("keeps the change when the request succeeds", async () => {
    let state = "open";
    const r = await optimistic({ apply: () => { state = "done"; }, rollback: () => { state = "open"; }, request: async () => 42 });
    expect(r).toEqual({ ok: true, value: 42 });
    expect(state).toBe("done");
  });

  it("a failed stage change is rolled back to the previous stage", async () => {
    mockApi({ "PATCH /agencies/3": () => ({ status: 500, body: { error: "Database is locked" } }) });
    let stage = "contacted";
    const ok = await changeStage({ id: 3, from: "contacted", to: "demo", askReason: async () => null, apply: (s) => { stage = s; }, rollback: (s) => { stage = s; } });
    expect(ok).toBe(false);
    expect(stage).toBe("contacted");
  });
});
