import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  GitCommit,
  LineChart,
  ShieldCheck,
  Table,
} from "lucide-react";
import { Link } from "react-router-dom";

import { ForecastActualChart } from "../components/charts/ForecastActualChart";
import { Badge } from "../components/ui/Badge";
import { Card, CardHeader } from "../components/ui/Card";
import { CoverageIndicator } from "../components/ui/CoverageIndicator";
import { DataStatusBar } from "../components/ui/DataStatusBar";
import { KpiCard } from "../components/ui/KpiCard";
import { ErrorState, LoadingState } from "../components/ui/StatePanels";
import { useDashboard } from "../context/DashboardContext";
import { useApi } from "../hooks/useApi";
import { api } from "../services/api";
import {
  formatLeadHours,
  formatNumber,
  formatPct,
  formatUtcDateTime,
} from "../utils/format";

export function HomePage() {
  const { params, paramsKey } = useDashboard();
  const { data, error, loading, reload } = useApi(
    (signal) => api.overview(params, {}, signal),
    [paramsKey],
  );

  return (
    <div className="space-y-16 sm:space-y-24">
      {/* Hero Section */}
      <section className="pt-6 sm:pt-10 text-center">
        <div className="mx-auto max-w-3xl">
          <p className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-steel">
            <span className="h-1.5 w-1.5 rounded-full bg-lavender" aria-hidden="true" />
            ENERGY FORECAST INTELLIGENCE
          </p>

          <h1 className="mt-5 text-balance font-display text-4xl font-normal leading-[1.05] tracking-tight text-ghost sm:text-6xl sm:leading-[1.05]">
            See the wind.{" "}
            <span className="text-lavender">Understand the forecast.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-balance text-base leading-relaxed text-ash sm:text-lg">
            Explore UK wind generation forecasts, compare predictions with actual generation,
            and understand how forecast accuracy changes as delivery approaches.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/dashboard"
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-control bg-ghost px-6 text-xs font-semibold text-void transition-colors hover:bg-bone sm:w-auto"
            >
              Explore the dashboard
              <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </Link>
            <Link
              to="/explorer"
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-control border border-graphite bg-carbon px-6 text-xs font-medium text-ash transition-colors hover:border-steel hover:text-ghost sm:w-auto"
            >
              Explore the data
            </Link>
          </div>

          <p className="mt-6 text-xs tracking-wide text-steel">
            Historical analysis · Forecast versions · Half-hourly delivery intervals
          </p>
        </div>
      </section>

      {/* Product Preview Section */}
      <section className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-steel">
              Live Observatory Preview
            </p>
            <h2 className="font-display text-2xl font-normal text-ghost sm:text-3xl">
              January 2026 delivery window
            </h2>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-lavender transition-colors hover:text-bone"
          >
            Open full analytics dashboard
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
          </Link>
        </div>

        {loading ? (
          <LoadingState label="Loading observatory preview" />
        ) : null}

        {!loading && error ? (
          <ErrorState
            message={error.message}
            onRetry={reload}
            hint="The dashboard preview requires the backend API to retrieve Elexon BMRS analytics."
          />
        ) : null}

        {!loading && data ? (
          <div className="space-y-6">
            <DataStatusBar status={data.meta.data_status} />

            {/* KPI preview cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                label="Latest eligible forecast"
                value={
                  data.latest_eligible_forecast
                    ? formatNumber(data.latest_eligible_forecast.forecast_mw)
                    : "Unavailable"
                }
                unit={data.latest_eligible_forecast ? "MW" : undefined}
                icon={LineChart}
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
              />
              <KpiCard
                label="Latest actual generation"
                value={
                  data.latest_actual ? formatNumber(data.latest_actual.actual_mw) : "Unavailable"
                }
                unit={data.latest_actual ? "MW" : undefined}
                icon={BarChart3}
                tone="blue"
                unavailable={!data.latest_actual}
                subtitle={
                  data.latest_actual
                    ? formatUtcDateTime(data.latest_actual.delivery_start)
                    : "No actual generation in this window"
                }
              />
              <KpiCard
                label="Mean absolute error"
                value={
                  data.metrics.mae_mw === null ? "Unavailable" : formatNumber(data.metrics.mae_mw)
                }
                unit={data.metrics.mae_mw === null ? undefined : "MW"}
                icon={ShieldCheck}
                tone="amber"
                unavailable={data.metrics.mae_mw === null}
                subtitle={`${formatNumber(data.metrics.matched_observations)} matched observations`}
              />
              <KpiCard
                label="WAPE error"
                value={
                  data.metrics.wape_pct === null ? "Unavailable" : formatPct(data.metrics.wape_pct)
                }
                icon={CheckCircle2}
                tone="teal"
                unavailable={data.metrics.wape_pct === null}
                subtitle={
                  data.coverage.data_coverage_pct !== null
                    ? `${formatPct(data.coverage.data_coverage_pct)} data coverage`
                    : "Coverage calculated"
                }
              />
            </div>

            {/* Preview Chart & Coverage */}
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader
                  title="Forecast vs actual wind generation"
                  description="Half-hourly actual generation (white) compared against the selected forecast version (violet dashed)."
                  action={
                    <Badge tone="accent">
                      {data.meta.mode === "horizon"
                        ? `${formatNumber(data.meta.horizon_hours)}h horizon`
                        : "Latest"}
                    </Badge>
                  }
                />
                <div className="p-4 sm:p-5">
                  <ForecastActualChart series={data.series} />
                </div>
              </Card>

              <Card className="p-5">
                <CoverageIndicator coverage={data.coverage} />
              </Card>
            </div>
          </div>
        ) : null}
      </section>

      {/* What You Can Explore Section */}
      <section className="space-y-8">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-steel">
            Features & Workflows
          </p>
          <h2 className="mt-1 font-display text-2xl font-normal text-ghost sm:text-3xl">
            What you can explore
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ash">
            Three dedicated analytical tools designed for energy traders, analysts, and system researchers.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Card 1: Forecast Accuracy */}
          <Card className="flex flex-col justify-between p-6 transition-colors hover:border-steel">
            <div>
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-control border border-graphite bg-void text-lavender">
                  <BarChart3 className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
                </span>
                <Badge tone="neutral">Metrics</Badge>
              </div>
              <h3 className="mt-4 font-display text-xl font-normal text-ghost">
                Forecast accuracy
              </h3>
              <p className="mt-2 text-xs leading-5 text-ash">
                Compare forecast generation against actual generation using standard energy error
                metrics including MAE, RMSE, WAPE, and systematic bias across custom date ranges
                and horizons.
              </p>
            </div>
            <div className="mt-6 border-t border-graphite pt-4">
              <Link
                to="/accuracy"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-ghost hover:text-lavender"
              >
                Inspect accuracy diagnostics
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </div>
          </Card>

          {/* Card 2: Forecast Evolution */}
          <Card className="flex flex-col justify-between p-6 transition-colors hover:border-steel">
            <div>
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-control border border-graphite bg-void text-mint">
                  <GitCommit className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
                </span>
                <Badge tone="neutral">Timeline</Badge>
              </div>
              <h3 className="mt-4 font-display text-xl font-normal text-ghost">
                Forecast evolution
              </h3>
              <p className="mt-2 text-xs leading-5 text-ash">
                Inspect forecast revision histories for any half-hourly settlement period. See every
                published version, which version was eligible at the decision cutoff, and how
                predictions converged.
              </p>
            </div>
            <div className="mt-6 border-t border-graphite pt-4">
              <Link
                to="/evolution"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-ghost hover:text-lavender"
              >
                Trace forecast evolution
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </div>
          </Card>

          {/* Card 3: Data Explorer */}
          <Card className="flex flex-col justify-between p-6 transition-colors hover:border-steel sm:col-span-2 lg:col-span-1">
            <div>
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-control border border-graphite bg-void text-bone">
                  <Table className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
                </span>
                <Badge tone="neutral">Raw Records</Badge>
              </div>
              <h3 className="mt-4 font-display text-xl font-normal text-ghost">
                Data explorer
              </h3>
              <p className="mt-2 text-xs leading-5 text-ash">
                Browse every half-hourly interval with matched observations, availability statuses,
                and error values. Filter by availability state, sort columns, and export filtered
                records to CSV.
              </p>
            </div>
            <div className="mt-6 border-t border-graphite pt-4">
              <Link
                to="/explorer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-ghost hover:text-lavender"
              >
                Open data explorer & export
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </div>
          </Card>
        </div>
      </section>

      {/* Methodology Section */}
      <section className="rounded-card border border-graphite bg-carbon p-6 sm:p-8">
        <div className="max-w-3xl">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-steel">
            Measurement Principles
          </p>
          <h2 className="mt-2 font-display text-2xl font-normal text-ghost sm:text-3xl">
            Forecasts, measured against reality.
          </h2>
          <div className="mt-6 space-y-4 text-xs leading-6 text-ash">
            <p>
              <strong className="font-semibold text-ghost">Authoritative data sources:</strong> Actual
              outturn generation and national wind forecasts come directly from Elexon BMRS (FUELHH
              for outturn and WINDFOR for forecasts).
            </p>
            <p>
              <strong className="font-semibold text-ghost">Strict no-look-ahead cutoff:</strong> Forecast
              versions are selected strictly according to the configured evaluation rule. A forecast
              must have been published on or prior to the cutoff time to be eligible.
            </p>
            <p>
              <strong className="font-semibold text-ghost">Truth in matched observations:</strong> Accuracy
              metrics are calculated only on intervals where both an actual outturn and an eligible
              forecast exist. Missing data is preserved and never assumed or substituted as zero.
            </p>
            <p>
              <strong className="font-semibold text-ghost">Focused analytics scope:</strong> WindSight UK
              is an independent wind generation forecast analysis tool. It does not calculate total
              procurement requirements, system balancing costs, electricity market prices, or
              non-wind generation.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
