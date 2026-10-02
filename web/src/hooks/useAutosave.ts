import { useCallback, useEffect, useRef, useState } from "react";
import type { SaveState } from "@/components/app/SaveIndicator";

/**
 * Inline editing with autosave. Text saves 600ms after typing stops (or on
 * blur); selects/checkboxes save immediately. On failure the typed value is
 * kept, the field is marked invalid and the error is shown.
 */
export function useAutosave(save: (patch: Record<string, unknown>) => Promise<unknown>) {
  const [state, setState] = useState<SaveState>({ status: "idle" });
  const [invalid, setInvalid] = useState<Record<string, boolean>>({});
  const timers = useRef(new Map<string, number>());
  const lastSaved = useRef(new Map<string, unknown>());
  const pending = useRef(new Map<string, unknown>());
  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; });

  const flush = useCallback(async (field: string) => {
    window.clearTimeout(timers.current.get(field));
    if (!pending.current.has(field)) return;
    const value = pending.current.get(field);
    pending.current.delete(field);
    if (lastSaved.current.has(field) && lastSaved.current.get(field) === value) return;
    setState({ status: "saving" });
    try {
      await saveRef.current({ [field]: value });
      lastSaved.current.set(field, value);
      setInvalid((s) => ({ ...s, [field]: false }));
      setState({ status: "saved" });
    } catch (e) {
      setInvalid((s) => ({ ...s, [field]: true }));
      setState({ status: "error", message: (e as Error).message });
    }
  }, []);

  /** Call on every change. delay=0 saves now (selects, checkboxes). */
  const change = useCallback((field: string, value: unknown, delay = 600) => {
    const v = typeof value === "string" && value.trim() === "" ? null : value;
    pending.current.set(field, v);
    window.clearTimeout(timers.current.get(field));
    if (delay === 0) void flush(field);
    else timers.current.set(field, window.setTimeout(() => void flush(field), delay));
  }, [flush]);

  // Flush everything on unmount so nothing typed is lost.
  useEffect(() => () => { for (const f of [...pending.current.keys()]) void flush(f); }, [flush]);

  useEffect(() => {
    if (state.status !== "saved") return;
    const t = window.setTimeout(() => setState({ status: "idle" }), 2200);
    return () => window.clearTimeout(t);
  }, [state]);

  return { state, invalid, change, flush };
}
