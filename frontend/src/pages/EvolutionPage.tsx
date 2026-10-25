import { CalendarClock, Clock3, History, RotateCcw, Star } from "lucide-react";
import { useEffect, useState } from "react";

import { EvolutionChart } from "../components/charts/EvolutionChart";
import { Badge } from "../components/ui/Badge";
import { Callout } from "../components/ui/Callout";
import { Card, CardHeader } from "../components/ui/Card";
import { DataStatusBar } from "../components/ui/DataStatusBar";
import { KpiCard } from "../components/ui/KpiCard";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/StatePanels";
import { PERIOD_END, PERIOD_START, useDashboard } from "../context/DashboardContext";
import { useApi } from "../hooks/useApi";
import { api } from "../services/api";
import {
  formatHorizonLabel,
  formatLeadHours,
  formatNumber,
  formatSignedMw,
  formatUtcDateTime,
} from "../utils/format";

const times = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2)
    .toString()
    .padStart(2, "0");
  const minute = index % 2 === 0 ? "00" : "30";
  return `${hour}:${minute}`;
});

export function EvolutionPage() {
  const { params, paramsKey, selection } = useDashboard();
  const [deliveryStart, setDeliveryStart] = useState<string | undefined>(undefined);
  const [selectedDate, setSelectedDate] = useState(PERIOD_START);
  const [selectedTime, setSelectedTime] = useState("00:00");
  const [inputError, setInputError] = useState<string | null>(null);

  const { data, error, loading, reload } = useApi(
    (signal) => api.forecastHistory(params, deliveryStart, signal),
    [paramsKey, deliveryStart],
  );

  useEffect(() => {
    if (data && deliveryStart !== data.delivery_start) {
      setDeliveryStart(data.delivery_start);
    }
  }, [data, deliveryStart]);

  useEffect(() => {
    if (data) {
      setSelectedDate(data.delivery_start.slice(0, 10));
      setSelectedTime(data.delivery_start.slice(11, 16));
    }
  }, [data]);

  function selectInterval(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedDate < PERIOD_START || selectedDate > PERIOD_END) {
      setInputError("Choose a delivery date in January 2026.");
      return;
    }
    setInputError(null);
    setDeliveryStart(`${selectedDate}T${selectedTime}:00Z`);
  }

  const noEligibleInterval =
    !deliveryStart && error?.status === 400 && error.message.startsWith("No eligible forecast");

  const eligibleCount = data?.versions.filter((version) => version.eligible_at_cutoff).length ?? 0;
  const decisionLeadHours =
    data && data.delivery_start
      ? (new Date(data.delivery_start).getTime() - new Date(data.decision_cutoff).getTime()) /
        3_600_000
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Forecast version history"
        title="Forecast evolution"
        description="Inspect every retained forecast version for one delivery interval and see how the selected forecast changed as publication time approached the decision cutoff."
        actions={
          <Badge tone={selection.mode === "horizon" ? "accent" : "info"}>
            {selection.mode === "horizon"
              ? formatHorizonLabel(selection.horizonHours)
              : "Latest available backtest"}
          </Badge>
        }
      />

      <Card className="p-5">
        <form onSubmit={selectInterval} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block w-full sm:w-auto">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.14em] text-steel">
                Delivery date
              </span>
              <input
                type="date"
                min={PERIOD_START}
                max={PERIOD_END}
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="h-9 w-full rounded-control border border-graphite bg-carbon px-2.5 text-xs font-medium text-bone outline-none transition-colors hover:border-steel focus:border-lavender sm:w-auto"
              />
            </label>
            <label className="block w-full sm:w-auto">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.14em] text-steel">
                Delivery interval (UTC)
              </span>
              <select
                value={selectedTime}
                onChange={(event) => setSelectedTime(event.target.value)}
                className="h-9 w-full min-w-28 rounded-control border border-graphite bg-carbon px-2.5 text-xs font-medium text-bone outline-none transition-colors hover:border-steel focus:border-lavender sm:w-auto"
              >
                {times.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-control bg-ghost px-4 text-xs font-semibold text-void transition-colors hover:bg-bone sm:w-auto"
            >
              <CalendarClock className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              Load interval
            </button>
            <button
              type="button"
              onClick={() => {
                setInputError(null);
                setDeliveryStart(undefined);
              }}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-control border border-graphite bg-carbon px-3 text-xs font-medium text-ash transition-colors hover:border-steel hover:text-ghost sm:w-auto"
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              Latest eligible interval
            </button>
          </div>
          <p className="text-[11px] leading-5 text-steel">
            Eligibility is evaluated at the decision cutoff selected in the header. In Forecast
            horizon mode the cutoff is delivery start minus the selected horizon. WINDFOR
            forecasts are hourly, so both half-hours in an hour use the forecast for that hour.
          </p>
          {inputError ? (
            <p className="text-[11px] font-medium text-danger" role="alert">
              {inputError}
            </p>
          ) : null}
        </form>
      </Card>

      {loading ? <LoadingState label="Loading forecast versions" /> : null}
      {!loading && noEligibleInterval ? (
        <EmptyState
          title="No eligible interval for this horizon"
          message="No delivery interval in the analysis period has a forecast published at least that far before delivery. Choose a delivery date and interval above, or reduce the forecast horizon."
        />
      ) : null}
      {!loading && error && !noEligibleInterval ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : null}

      {!loading && data ? (
        <>
          <DataStatusBar status={data.meta.data_status} />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Delivery interval"
              value={formatUtcDateTime(data.delivery_start)}
              icon={Clock3}
              tone="slate"
              valueSize="compact"
              subtitle={`Forecast hour ${formatUtcDateTime(data.forecast_valid_time)}`}
            />
            <KpiCard
              label="Forecast versions"
              value={formatNumber(data.versions.length)}
              icon={History}
              tone="blue"
              subtitle={`${formatNumber(eligibleCount)} eligible at the selected cutoff`}
            />
            <KpiCard
              label="Selected forecast"
              value={data.selected_forecast_mw === null ? "Unavailable" : formatNumber(data.selected_forecast_mw)}
              unit={data.selected_forecast_mw === null ? undefined : "MW"}
              icon={Star}
              tone="teal"
              unavailable={data.selected_forecast_mw === null}
              subtitle={
                data.selected_publish_time
                  ? `Published ${formatUtcDateTime(data.selected_publish_time)}`
                  : "No version published by the cutoff"
              }
            />
            <KpiCard
              label="Actual generation"
              value={data.actual_mw === null ? "Unavailable" : formatNumber(data.actual_mw)}
              unit={data.actual_mw === null ? undefined : "MW"}
              icon={CalendarClock}
              tone="amber"
              unavailable={data.actual_mw === null}
              subtitle={
                data.selected_forecast_mw !== null && data.actual_mw !== null
                  ? `Selected forecast error: ${formatSignedMw(data.selected_forecast_mw - data.actual_mw)}`
                  : "No FUELHH actual for this interval"
              }
            />
          </div>

          <div className="flex flex-col gap-2 rounded-card border border-graphite bg-carbon px-4 py-3 text-xs text-steel sm:flex-row sm:items-center sm:justify-between">
            <p>
              Decision cutoff:{" "}
              <span className="font-medium text-bone">
                {formatUtcDateTime(data.decision_cutoff)}
              </span>
            </p>
            <p>
              Selected publication lead time:{" "}
              <span className="font-medium text-bone">
                {data.selected_publish_time
                  ? formatLeadHours(
                      (new Date(data.delivery_start).getTime() -
                        new Date(data.selected_publish_time).getTime()) /
                        3_600_000,
                    )
                  : "—"}
              </span>
            </p>
          </div>

          <Card>
            <CardHeader
              title="How the forecast changed toward delivery"
              description="Each point is a forecast version. Mint points were eligible at the cutoff; grey points were published later. The violet point is the selected version. The dashed horizontal line is actual generation."
              action={<Badge tone="neutral">MW</Badge>}
            />
            <div className="min-w-0 px-2 pb-2 pt-2">
              {data.versions.length ? (
                <EvolutionChart
                  versions={data.versions}
                  actualMw={data.actual_mw}
                  decisionLeadHours={decisionLeadHours}
                />
              ) : (
                <EmptyState
                  title="No forecast versions for this interval"
                  message="The source has no retained WINDFOR forecast for this forecast hour. Choose a different delivery date or selection."
                />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Forecast versions at this cutoff"
              description="Published, forecasted generation, lead time, eligibility and error for every retained version."
              action={
                <Badge tone={eligibleCount ? "success" : "warning"}>
                  {formatNumber(eligibleCount)} eligible
                </Badge>
              }
            />
            {data.versions.length ? (
              <>
                <p className="border-b border-graphite px-4 py-2 text-[10px] text-steel sm:hidden">
                  Scroll horizontally to inspect every field.
                </p>
                <div className="overflow-x-auto">
                <table className="min-w-[900px] text-left text-xs">
                  <thead className="border-b border-graphite bg-void text-[10px] uppercase tracking-[0.12em] text-steel">
                    <tr>
                      <th className="px-5 py-3 font-medium">Published (UTC)</th>
                      <th className="px-4 py-3 text-right font-medium">Forecast (MW)</th>
                      <th className="px-4 py-3 text-right font-medium">Lead time</th>
                      <th className="px-4 py-3 font-medium">At cutoff</th>
                      <th className="px-4 py-3 text-right font-medium">Signed error (MW)</th>
                      <th className="px-4 py-3 text-right font-medium">Absolute error (MW)</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {data.versions.map((version) => (
                      <tr
                        key={version.publish_time}
                        className={
                          version.is_selected
                            ? "bg-lavender/[0.08]"
                            : "transition-colors hover:bg-white/[0.03]"
                        }
                      >
                        <td className="whitespace-nowrap px-5 py-2.5 font-medium text-bone">
                          {formatUtcDateTime(version.publish_time)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-ash">
                          {formatNumber(version.forecast_mw)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-ash">
                          {formatLeadHours(version.forecast_lead_hours)}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge tone={version.eligible_at_cutoff ? "success" : "neutral"}>
                            {version.eligible_at_cutoff ? "Eligible" : "After cutoff"}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-ash">
                          {formatNumber(version.signed_error_mw)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-ash">
                          {formatNumber(version.abs_error_mw)}
                        </td>
                        <td className="px-5 py-2.5">
                          {version.is_selected ? (
                            <Badge tone="accent">Selected</Badge>
                          ) : version.published_before_delivery ? (
                            <span className="text-steel">Not selected</span>
                          ) : (
                            <Badge tone="warning">Post-delivery</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </>
            ) : (
              <p className="px-5 py-8 text-center text-xs text-steel">
                No forecast versions are available for this delivery start.
              </p>
            )}
          </Card>

          {data.selected_publish_time &&
          new Date(data.selected_publish_time) > new Date(data.delivery_start) ? (
            <Callout tone="warning" title="The selected version was published after delivery">
              The current cutoff allows a publication after the delivery interval began. This is
              not a decision-time forecast. Switch to Forecast horizon mode or choose an earlier
              cutoff to enforce information availability.
            </Callout>
          ) : (
            <Callout title="Look-ahead control">
              A version is eligible only if its publishTime is at or before the decision cutoff.
              Later publications remain visible for comparison but are excluded from the selected
              forecast and its error.
            </Callout>
          )}
        </>
      ) : null}
    </div>
  );
}
