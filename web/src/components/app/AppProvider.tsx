import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { onChange, pendingDeletes } from "@/lib/events";
import type { AgencyListItem } from "@/lib/types";
import { DeclineReasonDialog } from "./DeclineReasonDialog";

export interface QuickLogOptions { agencyId?: number | null; channel?: "call" | "email" }

interface AppState {
  agencies: AgencyListItem[];
  agenciesError: Error | null;
  refreshAgencies: () => Promise<void>;
  quickLog: QuickLogOptions | null;
  openQuickLog: (o?: QuickLogOptions) => void;
  closeQuickLog: () => void;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
  helpOpen: boolean;
  setHelpOpen: (v: boolean) => void;
  askDeclineReason: () => Promise<string | null>;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [agencies, setAgencies] = useState<AgencyListItem[]>([]);
  const [agenciesError, setAgenciesError] = useState<Error | null>(null);
  const [quickLog, setQuickLog] = useState<QuickLogOptions | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const declineResolve = useRef<((v: string | null) => void) | null>(null);

  const refreshAgencies = useCallback(async () => {
    try {
      const r = await api<{ agencies: AgencyListItem[] }>("/agencies");
      setAgencies(r.agencies.filter((a) => !pendingDeletes.has(a.id)));
      setAgenciesError(null);
    } catch (e) { setAgenciesError(e as Error); }
  }, []);

  useEffect(() => { void refreshAgencies(); return onChange(() => void refreshAgencies()); }, [refreshAgencies]);

  const askDeclineReason = useCallback(() => new Promise<string | null>((resolve) => {
    declineResolve.current = resolve;
    setDeclineOpen(true);
  }), []);
  const finishDecline = (v: string | null) => {
    setDeclineOpen(false);
    declineResolve.current?.(v);
    declineResolve.current = null;
  };

  const value = useMemo<AppState>(() => ({
    agencies, agenciesError, refreshAgencies,
    quickLog, openQuickLog: (o = {}) => setQuickLog(o), closeQuickLog: () => setQuickLog(null),
    paletteOpen, setPaletteOpen, helpOpen, setHelpOpen, askDeclineReason,
  }), [agencies, agenciesError, refreshAgencies, quickLog, paletteOpen, helpOpen, askDeclineReason]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <DeclineReasonDialog open={declineOpen} onSubmit={(r) => finishDecline(r)} onCancel={() => finishDecline(null)} />
    </Ctx.Provider>
  );
}
