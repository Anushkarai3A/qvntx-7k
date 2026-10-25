import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { SelectionParams } from "../services/api";
import type { SelectionMode } from "../types/api";

export const PERIOD_START = "2026-01-01";
export const PERIOD_END = "2026-01-31";
export const DEFAULT_CUTOFF = "2026-02-01T00:00:00Z";
export const HORIZON_OPTIONS = [3, 6, 12, 24, 36, 48, 72];

export interface SelectionState {
  mode: SelectionMode;
  cutoff: string;
  horizonHours: number;
}

interface DashboardContextValue {
  selection: SelectionState;
  params: SelectionParams;
  paramsKey: string;
  applySelection: (next: SelectionState) => void;
  setHorizon: (hours: number) => void;
  setLatestMode: () => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<SelectionState>({
    mode: "horizon",
    cutoff: DEFAULT_CUTOFF,
    horizonHours: 24,
  });

  const applySelection = useCallback((next: SelectionState) => {
    setSelection(next);
  }, []);

  const setHorizon = useCallback((hours: number) => {
    setSelection((current) => ({ ...current, mode: "horizon", horizonHours: hours }));
  }, []);

  const setLatestMode = useCallback(() => {
    setSelection((current) => ({ ...current, mode: "latest" }));
  }, []);

  const params = useMemo<SelectionParams>(
    () =>
      selection.mode === "latest"
        ? { mode: "latest", cutoff: selection.cutoff }
        : { mode: "horizon", horizon_hours: selection.horizonHours },
    [selection],
  );

  const value = useMemo(
    () => ({
      selection,
      params,
      paramsKey: JSON.stringify(params),
      applySelection,
      setHorizon,
      setLatestMode,
    }),
    [selection, params, applySelection, setHorizon, setLatestMode],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard(): DashboardContextValue {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used inside DashboardProvider");
  }
  return context;
}
