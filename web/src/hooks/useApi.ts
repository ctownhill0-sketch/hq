import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

/** Load JSON from the API with loading/error state, reload and local updates. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState<boolean>(path !== null);
  const seq = useRef(0);

  const load = useCallback(async (opts: { quiet?: boolean } = {}) => {
    if (path === null) return;
    const n = ++seq.current;
    if (!opts.quiet) setLoading(true);
    try {
      const d = await api<T>(path);
      if (n === seq.current) { setData(d); setError(null); }
    } catch (e) {
      if (n === seq.current) setError(e as Error);
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => { void load(); }, [load]);

  return { data, setData, error, loading, reload: load };
}
