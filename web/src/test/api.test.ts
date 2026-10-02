import { afterEach, describe, expect, it, vi } from "vitest";
import { api, resetCsrfForTests } from "@/lib/api";
import { mockApi } from "./fetchMock";

afterEach(() => { vi.unstubAllGlobals(); resetCsrfForTests(); });

describe("CSRF", () => {
  it("sends X-CSRF-Token on every write and not on reads", async () => {
    const m = mockApi({ "GET /agencies": { agencies: [] }, "POST /tasks": { id: 1 }, "PATCH /tasks/1": { ok: true }, "DELETE /tasks/1": { ok: true }, "PUT /agencies/1/place": { ok: true } });
    await api("/agencies");
    await api("/tasks", { method: "POST", body: { title: "x" } });
    await api("/tasks/1", { method: "PATCH", body: { status: "done" } });
    await api("/agencies/1/place", { method: "PUT", body: { place_id: "ChIJabcdefghijk" } });
    await api("/tasks/1", { method: "DELETE" });
    const get = m.calls.find((c) => c.url === "/api/agencies")!;
    expect(get.headers["X-CSRF-Token"]).toBeUndefined();
    expect(m.writes()).toHaveLength(4);
    for (const w of m.writes()) expect(w.headers["X-CSRF-Token"]).toBe("test-token-123");
    // The token is fetched once and reused.
    expect(m.calls.filter((c) => c.url === "/api/session")).toHaveLength(1);
  });

  it("refreshes the token once if the server restarted", async () => {
    let first = true;
    const m = mockApi({
      "POST /tasks": () => {
        if (first) { first = false; return { status: 403, body: { error: "Missing or invalid CSRF token.", code: "CSRF" } }; }
        return { body: { id: 2 } };
      },
    });
    await expect(api("/tasks", { method: "POST", body: { title: "x" } })).resolves.toEqual({ id: 2 });
    expect(m.calls.filter((c) => c.url === "/api/session")).toHaveLength(2);
  });

  it("surfaces server errors with their message", async () => {
    mockApi({ "POST /tasks": () => ({ status: 400, body: { error: "Invalid input: title: required", code: "VALIDATION" } }) });
    await expect(api("/tasks", { method: "POST", body: {} })).rejects.toThrow("title: required");
  });
});
