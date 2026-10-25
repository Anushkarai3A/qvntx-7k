import { AlertTriangle, CalendarDays, Gauge, Percent, Ruler, Scale } from "lucide-react";
import { useState } from "react";

import { DailyErrorChart } from "../components/charts/DailyErrorChart";
import { ErrorTimelineChart } from "../components/charts/ErrorTimelineChart";
import { ForecastActualChart } from "../components/charts/ForecastActualChart";
import { HorizonChart } from "../components/charts/HorizonChart";
import { Badge } from "../components/ui/Badge";
import { Callout } from "../components/ui/Callout";
import { Card, CardHeader } from "../components/ui/Card";
import { CoverageIndicator } from "../components/ui/CoverageIndicator";
import { DataStatusBar } from "../components/ui/DataStatusBar";
import { KpiCard } from "../components/ui/KpiCard";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/StatePanels";
import {
  HORIZON_OPTIONS,
  PERIOD_END,
  PERIOD_START,
  useDashboard,
} from "../context/DashboardContext";
import { useApi } from "../hooks/useApi";
import { api } from "../services/api";
import type { GroupMetrics } from "../types/api";
import {
  formatHorizonLabel,
  formatMw,
  formatNumber,
  formatPct,
  formatUtcDate,
} from "../utils/format";

type GroupTab = "date" | "interval" | "horizon";

function GroupTable({
  groups,
  tab,
}: {
  groups: GroupMetrics[];
  tab: GroupTab;
}) {
  if (!groups.length) {
    return (
      <p className="px-5 py-10 text-center text-xs text-steel">
        No matched observations for this grouping.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[820px] text-left text-xs">
        <thead className="border-b border-graphite bg-void text-[10px] uppercase tracking-[0.12em] text-steel">
          <tr>
            <th className="px-5 py-3 font-medium">
              {tab === "date" ? "Delivery date" : tab === "interval" ? "Interval (UTC)" : "Lead time bucket"}
            </th>
            <th className="px-4 py-3 text-right font-medium">Matched</th>
            <th className="px-4 py-3 text-right font-medium">Bias (MW)</th>
            <th className="px-4 py-3 text-right font-medium">MAE (MW)</th>
            <th className="px-4 py-3 text-right font-medium">RMSE (MW)</th>
            <th className="px-5 py-3 text-right font-medium">WAPE (%)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {groups.map((group) => (
            <tr key={group.label} className="transition-colors hover:bg-white/[0.03]">
              <td className="whitespace-nowrap px-5 py-2.5 font-medium text-bone">
                {tab === "date" ? formatUtcDate(`${group.label}T00:00:00Z`) : group.label}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-ash">
                {formatNumber(group.matched_observations)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-ash">
                {formatNumber(group.mean_error_mw)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-ash">
                {formatNumber(group.mae_mw)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-ash">
                {formatNumber(group.rmse_mw)}
              </td>
              <td className="px-5 py-2.5 text-right tabular-nums text-ash">
                {formatPct(group.wape_pct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AccuracyPage() {
  const { params, paramsKey, selection, setHorizon, setLatestMode } = useDashboard();
  const [startDate, setStartDate] = useState(PERIOD_START);
  const [endDate, setEndDate] = useState(PERIOD_END);
  const [appliedDates, setAppliedDates] = useState({
    start_date: PERIOD_START,
    end_date: PERIOD_END,
  });
  const [dateError, setDateError] = useState<string | null>(null);
  const [groupTab, setGroupTab] = useState<GroupTab>("date");

  const { data, error, loading, reload } = useApi(
    (signal) => api.accuracy(params, appliedDates, signal),
    [paramsKey, appliedDates.start_date, appliedDates.end_date],
  );

  function applyDates(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!startDate || !endDate) {
      setDateError("Choose both a start and end delivery date.");
      return;
    }
    if (startDate > endDate) {
      setDateError("Start date must be on or before end date.");
      return;
    }
    setDateError(null);
    setAppliedDates({ start_date: startDate, end_date: endDate });
  }

  const groups =
    groupTab === "date" ? data?.by_date : groupTab === "interval" ? data?.by_interval : data?.by_horizon;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Accuracy diagnostics"
        title="Forecast accuracy"
        description="Signed and absolute forecast errors, headline accuracy metrics and coverage. Metrics use matched half-hourly observations only; missing data is never counted as zero."
        actions={
          <Badge tone={selection.mode === "horizon" ? "accent" : "info"}>
            {selection.mode === "horizon"
              ? formatHorizonLabel(selection.horizonHours)
              : "Latest available"}
          </Badge>
        }
      />

      <Card className="p-5">
        <form onSubmit={applyDates} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block w-full sm:w-auto">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.14em] text-steel">
                Delivery date from
              </span>
              <input
                type="date"
                min={PERIOD_START}
                max={PERIOD_END}
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="h-9 w-full rounded-control border border-graphite bg-carbon px-2.5 text-xs font-medium text-bone outline-none transition-colors hover:border-steel focus:border-lavender sm:w-auto"
              />
            </label>
            <label className="block w-full sm:w-auto">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.14em] text-steel">
                Delivery date to
              </span>
              <input
                type="date"
                min={PERIOD_START}
                max={PERIOD_END}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="h-9 w-full rounded-control border border-graphite bg-carbon px-2.5 text-xs font-medium text-bone outline-none transition-colors hover:border-steel focus:border-lavender sm:w-auto"
              />
            </label>
            <button
              type="submit"
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-control bg-ghost px-4 text-xs font-semibold text-void transition-colors hover:bg-bone sm:w-auto"
            >
              <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              Apply dates
            </button>
            {dateError ? (
              <p className="text-[11px] font-medium text-danger" role="alert">
                {dateError}
              </p>
            ) : null}
          </div>

          <div className="border-t border-graphite pt-4">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-steel">
              Forecast horizon filter
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={setLatestMode}
                className={`rounded-control border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  selection.mode === "latest"
                    ? "border-ghost bg-ghost text-void"
                    : "border-graphite bg-carbon text-ash hover:border-steel hover:text-ghost"
                }`}
              >
                Latest available
              </button>
              {HORIZON_OPTIONS.map((hours) => (
                <button
                  key={hours}
                  type="button"
                  onClick={() => setHorizon(hours)}
                  className={`rounded-control border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                    selection.mode === "horizon" && selection.horizonHours === hours
                      ? "border-ghost bg-ghost text-void"
                      : "border-graphite bg-carbon text-ash hover:border-steel hover:text-ghost"
                  }`}
                >
                  {formatNumber(hours)}h
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-5 text-steel">
              The horizon is the number of hours before delivery in which a forecast must have
              been published. It is not an official market deadline.
            </p>
          </div>
        </form>
      </Card>

      {loading ? <LoadingState label="Loading accuracy metrics" /> : null}
      {!loading && error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : null}

      {!loading && data ? (
        <>
          <DataStatusBar status={data.meta.data_status} />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Mean absolute error"
              value={data.metrics.mae_mw === null ? "Unavailable" : formatNumber(data.metrics.mae_mw)}
              unit={data.metrics.mae_mw === null ? undefined : "MW"}
              icon={Ruler}
              tone="amber"
              unavailable={data.metrics.mae_mw === null}
              subtitle={`${formatNumber(data.metrics.matched_observations)} matched observations`}
            />
            <KpiCard
              label="Root mean squared error"
              value={data.metrics.rmse_mw === null ? "Unavailable" : formatNumber(data.metrics.rmse_mw)}
              unit={data.metrics.rmse_mw === null ? undefined : "MW"}
              icon={Gauge}
              tone="blue"
              unavailable={data.metrics.rmse_mw === null}
              subtitle="Penalises large errors more heavily than MAE"
            />
            <KpiCard
              label="Weighted absolute percentage error"
              value={data.metrics.wape_pct === null ? "Unavailable" : formatNumber(data.metrics.wape_pct, 1)}
              unit={data.metrics.wape_pct === null ? undefined : "%"}
              icon={Percent}
              tone="teal"
              unavailable={data.metrics.wape_pct === null}
              subtitle="Generation-weighted; undefined when total actuals are zero"
            />
            <KpiCard
              label="Mean error / bias"
              value={
                data.metrics.mean_error_mw === null
                  ? "Unavailable"
                  : formatNumber(data.metrics.mean_error_mw)
              }
              unit={data.metrics.mean_error_mw === null ? undefined : "MW"}
              icon={Scale}
              tone={data.metrics.mean_error_mw !== null && data.metrics.mean_error_mw > 0 ? "rose" : "teal"}
              unavailable={data.metrics.mean_error_mw === null}
              subtitle="Mean of forecast minus actual"
            />
          </div>

          <Callout title="Units are deliberately separated">
            MAE, RMSE, bias, signed error and absolute error are expressed in MW. WAPE is a
            percentage. WAPE is not MAPE: it divides the sum of absolute errors by the sum of
            absolute actual generation, so large intervals carry more weight.
          </Callout>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
            <Card>
              <CardHeader
                title="Actual versus selected forecast"
                description={`${formatUtcDate(data.meta.delivery_start)} to ${formatUtcDate(data.meta.delivery_end)} · ${formatNumber(data.meta.expected_intervals)} expected intervals`}
                action={<Badge tone="neutral">MW</Badge>}
              />
              <div className="px-2 pb-3 pt-3">
                <ForecastActualChart series={data.series} />
              </div>
            </Card>

            <Card className="p-5">
              <CoverageIndicator coverage={data.coverage} />
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader
                title="Signed and absolute error"
                description="Positive signed error means the forecast exceeded actual generation. Absolute error removes direction."
                action={<Badge tone="neutral">MW</Badge>}
              />
              <div className="px-2 pb-3 pt-3">
                <ErrorTimelineChart series={data.series} />
              </div>
            </Card>
            <Card>
              <CardHeader
                title="Bias and MAE by delivery date"
                description="Daily aggregation of matched observations. Bars show bias; the line shows MAE."
                action={<Badge tone="neutral">MW</Badge>}
              />
              <div className="px-2 pb-3 pt-3">
                <DailyErrorChart groups={data.by_date} />
              </div>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
            <Card>
              <CardHeader
                title="WAPE by forecast lead time"
                description="Actual lead time between forecast publication and delivery, bucketed. Post-delivery versions appear only when the selected cutoff allows them."
                action={<Badge tone="neutral">%</Badge>}
              />
              <div className="px-2 pb-3 pt-3">
                <HorizonChart groups={data.by_horizon} />
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="font-display text-[1.35rem] leading-tight text-ghost">
                Missing-data indicators
              </h3>
              <dl className="mt-4 space-y-3 text-xs">
                <div className="flex items-center justify-between gap-4 border-b border-graphite pb-3">
                  <dt className="text-steel">Expected intervals</dt>
                  <dd className="font-medium tabular-nums text-bone">
                    {formatNumber(data.coverage.expected_intervals)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-graphite pb-3">
                  <dt className="text-steel">Missing actuals</dt>
                  <dd className="font-medium tabular-nums text-bone">
                    {formatNumber(data.coverage.missing_actuals)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-graphite pb-3">
                  <dt className="text-steel">Missing eligible forecasts</dt>
                  <dd className="font-medium tabular-nums text-bone">
                    {formatNumber(data.coverage.missing_eligible_forecasts)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-graphite pb-3">
                  <dt className="text-steel">Matched coverage</dt>
                  <dd className="font-medium tabular-nums text-bone">
                    {formatPct(data.coverage.data_coverage_pct)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-steel">Maximum absolute error</dt>
                  <dd className="font-medium tabular-nums text-bone">
                    {formatMw(data.metrics.max_abs_error_mw)}
                  </dd>
                </div>
              </dl>
              {(data.coverage.missing_actuals > 0 ||
                data.coverage.missing_eligible_forecasts > 0) ? (
                <div className="mt-4 flex items-start gap-2 rounded-control border border-graphite bg-void/40 p-3 text-[11px] leading-5 text-ash">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bone" strokeWidth={1.5} aria-hidden="true" />
                  <p>
                    Coverage is partial. Missing observations are excluded from metrics rather
                    than treated as zero.
                  </p>
                </div>
              ) : null}
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                title: "Signed error",
                body: "F − A for each matched interval. Positive means the forecast was above actual generation. Unit: MW.",
              },
              {
                title: "Bias / mean error",
                body: "Arithmetic mean of signed errors across matched observations. Unit: MW.",
              },
              {
                title: "MAE and RMSE",
                body: "MAE is the mean absolute error. RMSE is the square root of the mean squared error. Both are MW.",
              },
              {
                title: "WAPE",
                body: "Sum of absolute errors ÷ sum of absolute actual generation × 100. Percentage; not MAPE.",
              },
            ].map((metric) => (
              <Card key={metric.title} className="p-4">
                <p className="text-xs font-medium text-bone">{metric.title}</p>
                <p className="mt-2 text-[11px] leading-5 text-steel">{metric.body}</p>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader
              title="Accuracy groups"
              description="Matched observations only. Use the tabs to inspect delivery date, half-hourly interval or forecast lead-time buckets."
              action={
                <div className="flex rounded-control border border-graphite bg-void p-0.5">
                  {(
                    [
                      ["date", "Date"],
                      ["interval", "Interval"],
                      ["horizon", "Lead time"],
                    ] as Array<[GroupTab, string]>
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setGroupTab(value)}
                      className={`rounded-[4px] px-3 py-1.5 text-[11px] font-medium transition-colors ${
                        groupTab === value
                          ? "bg-graphite text-ghost"
                          : "text-steel hover:text-ghost"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              }
            />
            {groups && groups.length ? (
              <GroupTable groups={groups} tab={groupTab} />
            ) : (
              <div className="p-4">
                <EmptyState
                  title="No grouped metrics"
                  message="No matched actual/forecast observations are available for this date range and selection."
                />
              </div>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
