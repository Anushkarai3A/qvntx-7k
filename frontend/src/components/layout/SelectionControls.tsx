import { CalendarRange, ChevronDown, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";

import {
  DEFAULT_CUTOFF,
  HORIZON_OPTIONS,
  PERIOD_END,
  PERIOD_START,
  useDashboard,
} from "../../context/DashboardContext";
import type { SelectionState } from "../../context/DashboardContext";
import type { SelectionMode } from "../../types/api";
import { formatNumber, toUtcInputValue, utcInputToIso } from "../../utils/format";

const controlClass =
  "h-9 w-full min-w-0 rounded-control border border-graphite bg-carbon px-2.5 text-xs font-medium text-bone outline-none transition-colors placeholder:text-steel hover:border-steel focus:border-lavender sm:w-auto";

const iconControlClass = `${controlClass} pl-8 pr-8`;

export function SelectionControls() {
  const { selection, applySelection } = useDashboard();
  const [mode, setMode] = useState<SelectionMode>(selection.mode);
  const [cutoff, setCutoff] = useState(toUtcInputValue(selection.cutoff));
  const [horizon, setHorizon] = useState(selection.horizonHours);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMode(selection.mode);
    setCutoff(toUtcInputValue(selection.cutoff));
    setHorizon(selection.horizonHours);
  }, [selection]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const next: SelectionState = {
      mode,
      cutoff: mode === "latest" ? utcInputToIso(cutoff) : selection.cutoff,
      horizonHours: horizon,
    };
    if (next.mode === "latest" && !next.cutoff) {
      setError("Enter an evaluation cutoff.");
      return;
    }
    if (next.mode === "latest" && Number.isNaN(new Date(next.cutoff).getTime())) {
      setError("Enter a valid cutoff date and time.");
      return;
    }
    applySelection(next);
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between"
      aria-label="Analysis period and forecast selection"
    >
      <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:items-end">
        <label className="block w-full min-w-0 sm:w-auto">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.14em] text-steel">
            Delivery period
          </span>
          <span className="relative block">
            <CalendarRange
              className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-steel"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <select
              defaultValue="jan-2026"
              aria-label="Delivery period"
              className={`${iconControlClass} appearance-none`}
            >
              <option value="jan-2026">January 2026</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-steel"
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </span>
        </label>

        <label className="block w-full min-w-0 sm:w-auto">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.14em] text-steel">
            Selection mode
          </span>
          <span className="relative block">
            <SlidersHorizontal
              className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-steel"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as SelectionMode)}
              className={`${iconControlClass} appearance-none`}
            >
              <option value="horizon">Forecast horizon</option>
              <option value="latest">Latest available</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-steel"
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </span>
        </label>

        {mode === "horizon" ? (
          <label className="block w-full min-w-0 sm:w-auto">
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.14em] text-steel">
              Horizon
            </span>
            <select
              value={horizon}
              onChange={(event) => setHorizon(Number(event.target.value))}
              className={`${controlClass} min-w-0 sm:min-w-32`}
              aria-label="Forecast horizon"
            >
              {HORIZON_OPTIONS.map((hours) => (
                <option key={hours} value={hours}>
                  {formatNumber(hours)}h before delivery
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="block w-full min-w-0 sm:w-auto">
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.14em] text-steel">
              Evaluation cutoff (UTC)
            </span>
            <input
              type="datetime-local"
              step={1800}
              value={cutoff}
              min="2025-12-01T00:00"
              max="2026-02-28T23:30"
              onChange={(event) => setCutoff(event.target.value)}
              className={`${controlClass} min-w-0 sm:min-w-52`}
              aria-label="Evaluation cutoff"
            />
          </label>
        )}

        <button
          type="submit"
          className="h-9 w-full rounded-control bg-ghost px-4 text-xs font-semibold text-void transition-colors hover:bg-bone sm:w-auto"
        >
          Apply
        </button>
      </div>

      <div className="flex flex-col gap-1 xl:items-end">
        <p className="text-[10px] leading-4 text-steel">
          Data window {PERIOD_START} to {PERIOD_END} UTC ·{" "}
          {mode === "horizon"
            ? "cutoff = delivery start − horizon"
            : "cutoff excludes later publications"}
        </p>
        {error ? (
          <p className="text-[11px] font-medium text-danger" role="alert">
            {error}
          </p>
        ) : (
          <p className="text-[10px] text-steel">
            {mode === "latest"
              ? `Default cutoff ${DEFAULT_CUTOFF.replace("T", " ").replace(":00Z", " UTC")}`
              : "Forecast horizon is not the day-ahead market deadline"}
          </p>
        )}
      </div>
    </form>
  );
}
