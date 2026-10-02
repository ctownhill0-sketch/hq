// API client. Every request goes to our own local server (same origin).
// Writes carry the CSRF token read from GET /api/session (see src/security.js).

export class ApiError extends Error {
  status: number;
  code: string | null;
  data: unknown;
  constructor(message: string, status: number, code: string | null = null, data: unknown = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

let csrfToken: string | null = null;
let csrfPending: Promise<string> | null = null;

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  if (!csrfPending) {
    csrfPending = fetch("/api/session", { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(async (r) => {
        if (!r.ok) throw new ApiError("Could not start a session with the HQ Desk server.", r.status);
        const body = (await r.json()) as { csrfToken: string };
        csrfToken = body.csrfToken;
        return csrfToken;
      })
      .finally(() => { csrfPending = null; });
  }
  return csrfPending;
}

/** Test helper: forget the cached token. */
export function resetCsrfForTests(): void { csrfToken = null; csrfPending = null; }

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export async function api<T = unknown>(path: string, opts: { method?: Method; body?: unknown } = {}): Promise<T> {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (method !== "GET") headers["X-CSRF-Token"] = await getCsrfToken();
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method, headers, credentials: "same-origin",
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch {
    throw new ApiError("Cannot reach the HQ Desk server. Is it still running in your terminal?", 0, "OFFLINE");
  }
  let data: unknown = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const d = (data ?? {}) as { error?: string; code?: string };
    // Server restarted: the token changed. Fetch a new one and retry once.
    if (res.status === 403 && d.code === "CSRF" && method !== "GET") {
      csrfToken = null;
      return api<T>(path, opts);
    }
    throw new ApiError(d.error || `Request failed (${res.status}).`, res.status, d.code ?? null, data);
  }
  const usage = (data as { usage?: unknown } | null)?.usage;
  if (usage) window.dispatchEvent(new CustomEvent("hq:usage", { detail: usage }));
  return data as T;
}
