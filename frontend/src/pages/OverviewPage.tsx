import {
  Activity,
  AlertTriangle,
  CalendarClock,
  Scale,
  Target,
  Wind,
} from "lucide-react";

import { DailyErrorChart } from "../components/charts/DailyErrorChart";
import { ForecastActualChart } from "../components/charts/ForecastActualChart";
import { Badge } from "../components/ui/Badge";
import { Callout } from "../components/ui/Callout";
import { Card, CardHeader } from "../components/ui/Card";
import { CoverageIndicator } from "../components/ui/CoverageIndicator";
import { DataStatusBar } from "../components/ui/DataStatusBar";
import { KpiCard } from "../components/ui/KpiCard";
import { PageHeader } from "../components/ui/PageHeader";
import { ErrorState, LoadingState } from "../components/ui/StatePanels";
import { useDashboard } from "../context/DashboardContext";
import { useApi } from "../hooks/useApi";
import { api } from "../services/api";
import {
  formatLeadHours,
  formatMode,
  formatMw,
  formatNumber,
  formatPct,
  formatUtcDateTime,
} from "../utils/format";

export function OverviewPage() {
  const { params, paramsKey, selection } = useDashboard();
  const { data, error, loading, reload } = useApi(
    (signal) => api.overview(params, {}, signal),
    [paramsKey],
  );

  const modeText =
    selection.mode === "horizon"
      ? `${formatNumber(selection.horizonHours)}h before each delivery interval`
      : `Published on or before ${formatUtcDateTime(selection.cutoff)}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="January 2026 delivery window"
        title="Wind forecast overview"
        description="National wind generation forecasts compared with Elexon FUELHH outturn. Every KPI and series is calculated by the API from the selected forecast eligibility rule."
        actions={
          <Badge tone={selection.mode === "horizon" ? "accent" : "info"}>
            {formatMode(selection.mode)}
          </Badge>
        }
      />

      {loading ? <LoadingState /> : null}
      {!loading && error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : null}

      {!loading && data ? (
        <>
          <DataStatusBar status={data.meta.data_status} />

          <div className="flex flex-col gap-2 rounded-card border border-graphite bg-carbon px-4 py-3 text-xs text-steel sm:flex-row sm:items-center sm:justify-between">
            <p className="inline-flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-lavender" strokeWidth={1.5} aria-hidden="true" />
              <span>
                <span className="font-medium text-bone">{formatMode(data.meta.mode)}</span> ·{" "}
                {modeText}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={data.meta.mode === "horizon" ? "success" : "neutral"}>
                No look-ahead beyond cutoff
              </Badge>
              {(data.coverage.data_coverage_pct ?? 0) < 100 ? (
                <Badge tone="warning">
                  <AlertTriangle className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
                  Partial coverage
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Latest eligible forecast"
              value={
                data.latest_eligible_forecast
                  ? formatNumber(data.latest_eligible_forecast.forecast_mw)
                  : "Unavailable"
              }
              unit={data.latest_eligible_forecast ? "MW" : undefined}
              icon={Wind}
              tone="teal"
              unavailable={!data.latest_eligible_forecast}
              subtitle={
                data.latest_eligible_forecast
                  ? `${formatUtcDateTime(data.latest_eligible_forecast.delivery_start)} · ${
                      data.latest_eligible_forecast.forecast_mw !== null
                        ? formatLeadHours(data.latest_eligible_forecast.forecast_lead_hours)
                        : "no lead time"
                    }`
                  : "No eligible forecast in this selection"
              }
              footer={
                data.latest_eligible_forecast ? (
                  <p className="text-[11px] text-steel">
                    Published {formatUtcDateTime(data.latest_eligible_forecast.publish_time)}
                  </p>
                ) : null
              }
            />
            <KpiCard
              label="Latest actual generation"
              value={
                data.latest_actual ? formatNumber(data.latest_actual.actual_mw) : "Unavailable"
              }
              unit={data.latest_actual ? "MW" : undefined}
              icon={Activity}
              tone="blue"
              unavailable={!data.latest_actual}
              subtitle={
                data.latest_actual
                  ? formatUtcDateTime(data.latest_actual.delivery_start)
                  : "No actual generation in this window"
              }
              footer={
                <p className="text-[11px] text-steel">
                  FUELHH WIND half-hourly outturn
                </p>
              }
            />
            <KpiCard
              label="Mean absolute error"
              value={data.metrics.mae_mw === null ? "Unavailable" : formatNumber(data.metrics.mae_mw)}
              unit={data.metrics.mae_mw === null ? undefined : "MW"}
              icon={Target}
              tone="amber"
              unavailable={data.metrics.mae_mw === null}
              subtitle={`${formatNumber(data.metrics.matched_observations)} matched observations`}
              footer={
                <p className="text-[11px] text-steel">
                  Absolute difference between forecast and actual
                </p>
              }
            />
            <KpiCard
              label="Forecast bias"
              value={
                data.metrics.mean_error_mw === null
                  ? "Unavailable"
                  : formatNumber(data.metrics.mean_error_mw)
              }
              unit={data.metrics.mean_error_mw === null ? undefined : "MW"}
              icon={Scale}
              tone={data.metrics.mean_error_mw !== null && data.metrics.mean_error_mw > 0 ? "rose" : "teal"}
              unavailable={data.metrics.mean_error_mw === null}
              subtitle={
                data.metrics.mean_error_mw === null
                  ? "Insufficient matched data"
                  : data.metrics.mean_error_mw > 0
                    ? "Forecast above actual on average"
                    : data.metrics.mean_error_mw < 0
                      ? "Forecast below actual on average"
                      : "No average directional bias"
              }
              footer={
                <p className="text-[11px] text-steel">
                  Mean signed error: forecast − actual
                </p>
              }
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
            <Card>
              <CardHeader
                title="Forecast versus actual wind generation"
                description="Selected forecast versions and FUELHH actual outturn, half-hourly. Each hourly WINDFOR value is applied to both settlement periods in its hour without interpolation."
                action={<Badge tone="neutral">MW</Badge>}
              />
              <div className="min-w-0 px-2 pb-2 pt-2">
                {data.series.length ? (
                  <ForecastActualChart series={data.series} />
                ) : (
                  <p className="p-8 text-center text-xs text-steel">No series data.</p>
                )}
              </div>
            </Card>

            <Card className="p-5">
              <CoverageIndicator coverage={data.coverage} />
              <div className="mt-5 border-t border-graphite pt-4">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-steel">
                  WAPE
                </p>
                <p className="mt-2 font-display text-[2rem] leading-none text-ghost">
                  {formatPct(data.metrics.wape_pct)}
                </p>
                <p className="mt-2 text-[11px] leading-5 text-steel">
                  Sum of absolute errors divided by the sum of absolute actuals. Not MAPE.
                </p>
              </div>
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
            <Card>
              <CardHeader
                title="Daily forecast error trend"
                description="Daily mean signed error (bars) and mean absolute error (line). Positive bias means the forecast was above actual generation."
                action={<Badge tone="neutral">MW</Badge>}
              />
              <div className="min-w-0 px-2 pb-2 pt-2">
                {data.by_date.length ? (
                  <DailyErrorChart groups={data.by_date} />
                ) : (
                  <p className="p-8 text-center text-xs text-steel">
                    No matched observations for this selection.
                  </p>
                )}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="font-display text-[1.35rem] leading-tight text-ghost">
                Metric snapshot
              </h3>
              <dl className="mt-4 space-y-3 text-xs">
                <div className="flex items-center justify-between gap-4 border-b border-graphite pb-3">
                  <dt className="text-steel">RMSE</dt>
                  <dd className="font-medium tabular-nums text-bone">
                    {formatMw(data.metrics.rmse_mw)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-graphite pb-3">
                  <dt className="text-steel">Maximum absolute error</dt>
                  <dd className="font-medium tabular-nums text-bone">
                    {formatMw(data.metrics.max_abs_error_mw)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-graphite pb-3">
                  <dt className="text-steel">Matched observations</dt>
                  <dd className="font-medium tabular-nums text-bone">
                    {formatNumber(data.metrics.matched_observations)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-steel">WAPE</dt>
                  <dd className="font-medium tabular-nums text-bone">
                    {formatPct(data.metrics.wape_pct)}
                  </dd>
                </div>
              </dl>
              <div className="mt-5 rounded-control border border-graphite bg-void/40 p-3 text-[11px] leading-5 text-ash">
                The latest forecast KPI is the most recent delivery interval with an eligible
                forecast, not necessarily the latest actual interval.
              </div>
            </Card>
          </div>

          {data.meta.mode === "latest" ? (
            <Callout title="Latest-available mode can include post-delivery publications">
              A global cutoff does not enforce a decision lead time. Check the forecast lead
              time and switch to Forecast horizon mode when evaluating what was knowable before
              a delivery decision.
            </Callout>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
