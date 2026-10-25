import { Badge } from "./Badge";
import type { CoverageStats } from "../../types/api";
import { formatNumber, formatPct } from "../../utils/format";

function CoverageRow({
  label,
  value,
  count,
  tone,
}: {
  label: string;
  value: number | null;
  count: number;
  tone: string;
}) {
  const width = Math.max(0, Math.min(value ?? 0, 100));
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-bone">{label}</span>
        <span className="tabular-nums text-steel">
          {formatPct(value)} <span className="text-graphite">·</span>{" "}
          {formatNumber(count)}
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className={`h-full rounded-full ${tone}`}
          style={{ width: `${width}%` }}
          role="progressbar"
          aria-label={label}
          aria-valuenow={value ?? 0}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}

export function CoverageIndicator({ coverage }: { coverage: CoverageStats }) {
  const isPartial = (coverage.data_coverage_pct ?? 0) < 100;
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-ghost">Data coverage</h3>
        <Badge tone={isPartial ? "warning" : "success"}>
          {isPartial ? "Partial coverage" : "Full coverage"}
        </Badge>
      </div>
      <div className="mt-5 space-y-4">
        <CoverageRow
          label="Actual observations"
          value={coverage.actual_coverage_pct}
          count={coverage.actual_observations}
          tone="bg-steel"
        />
        <CoverageRow
          label="Selected forecasts"
          value={coverage.forecast_coverage_pct}
          count={coverage.selected_forecasts}
          tone="bg-lavender"
        />
        <CoverageRow
          label="Matched actual + forecast"
          value={coverage.data_coverage_pct}
          count={coverage.matched_observations}
          tone="bg-mint"
        />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 rounded-control border border-graphite bg-void/40 p-3 text-xs">
        <div>
          <p className="text-steel">Missing actuals</p>
          <p className="mt-1 font-medium tabular-nums text-ghost">
            {formatNumber(coverage.missing_actuals)}
          </p>
        </div>
        <div>
          <p className="text-steel">Missing eligible forecasts</p>
          <p className="mt-1 font-medium tabular-nums text-ghost">
            {formatNumber(coverage.missing_eligible_forecasts)}
          </p>
        </div>
      </div>
      <p className="mt-4 text-[11px] leading-5 text-steel">
        Coverage is measured against the {formatNumber(coverage.expected_intervals)} expected
        half-hourly delivery intervals. Each hourly forecast covers both intervals in its hour;
        metrics use matched observations only.
      </p>
    </div>
  );
}
