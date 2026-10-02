import { vi } from "vitest";

export interface Recorded { method: string; url: string; headers: Record<string, string>; body: unknown }

/** Fake API: routes are "METHOD /path" -> response body (or a function). */
export function mockApi(routes: Record<string, unknown | ((body: unknown) => { status?: number; body: unknown })>) {
  const calls: Recorded[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const method = (init.method ?? "GET").toUpperCase();
    const headers = Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>));
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, headers, body });
    if (url === "/api/session") return new Response(JSON.stringify({ csrfToken: "test-token-123" }), { status: 200 });
    const path = url.replace(/^\/api/, "").split("?")[0];
    const key = `${method} ${path}`;
    const match = Object.keys(routes).find((k) => k === key || (k.endsWith("*") && key.startsWith(k.slice(0, -1))));
    if (!match) return new Response(JSON.stringify({ error: `No mock for ${key}` }), { status: 404 });
    const r = routes[match];
    const out = typeof r === "function" ? (r as (b: unknown) => { status?: number; body: unknown })(body) : { status: 200, body: r };
    return new Response(JSON.stringify(out.body), { status: out.status ?? 200, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, writes: () => calls.filter((c) => c.method !== "GET") };
}
