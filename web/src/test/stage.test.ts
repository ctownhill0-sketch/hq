import { afterEach, describe, expect, it, vi } from "vitest";
import { resetCsrfForTests } from "@/lib/api";
import { changeStage } from "@/lib/stage";
import { mockApi } from "./fetchMock";

afterEach(() => { vi.unstubAllGlobals(); resetCsrfForTests(); });

describe("stage change to Declined", () => {
  it("requires a reason: cancelling sends nothing and changes nothing", async () => {
    const m = mockApi({ "PATCH /agencies/7": { ok: true } });
    const apply = vi.fn();
    const ok = await changeStage({ id: 7, from: "contacted", to: "declined", askReason: async () => null, apply, rollback: vi.fn() });
    expect(ok).toBe(false);
    expect(apply).not.toHaveBeenCalled();
    expect(m.writes()).toHaveLength(0);
  });

  it("a blank reason is treated as no reason", async () => {
    const m = mockApi({ "PATCH /agencies/7": { ok: true } });
    expect(await changeStage({ id: 7, from: "contacted", to: "declined", askReason: async () => "   ", apply: vi.fn(), rollback: vi.fn() })).toBe(false);
    expect(m.writes()).toHaveLength(0);
  });

  it("sends the reason with the stage", async () => {
    const m = mockApi({ "PATCH /agencies/7": { ok: true } });
    const ok = await changeStage({ id: 7, from: "contacted", to: "declined", askReason: async () => "Has a tool already", apply: vi.fn(), rollback: vi.fn() });
    expect(ok).toBe(true);
    expect(m.writes()[0].body).toEqual({ pipeline_stage: "declined", decline_reason: "Has a tool already" });
  });

  it("does not ask again if the agency already has a reason", async () => {
    const m = mockApi({ "PATCH /agencies/7": { ok: true } });
    const ask = vi.fn(async () => "x");
    await changeStage({ id: 7, from: "demo", to: "declined", currentReason: "Budget", askReason: ask, apply: vi.fn(), rollback: vi.fn() });
    expect(ask).not.toHaveBeenCalled();
    expect(m.writes()[0].body).toEqual({ pipeline_stage: "declined" });
  });

  it("other stages never ask for a reason", async () => {
    mockApi({ "PATCH /agencies/7": { ok: true } });
    const ask = vi.fn(async () => "x");
    await changeStage({ id: 7, from: "contacted", to: "demo", askReason: ask, apply: vi.fn(), rollback: vi.fn() });
    expect(ask).not.toHaveBeenCalled();
  });
});
