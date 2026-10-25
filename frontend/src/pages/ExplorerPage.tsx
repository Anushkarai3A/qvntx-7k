import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "../components/ui/Badge";
import { Callout } from "../components/ui/Callout";
import { Card, CardHeader } from "../components/ui/Card";
import { DataStatusBar } from "../components/ui/DataStatusBar";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/StatePanels";
import { PERIOD_END, PERIOD_START, useDashboard } from "../context/DashboardContext";
import { useApi } from "../hooks/useApi";
import { api } from "../services/api";
import type { DataAvailability, RecordRow } from "../types/api";
import { buildRecordsCsv, downloadCsv } from "../utils/csv";
import {
  dataStatusLabel,
  formatLeadHours,
  formatNumber,
  formatUtcTable,
} from "../utils/format";

type SortField =
  | "delivery_start"
  | "actual_mw"
  | "forecast_mw"
  | "forecast_publish_time"
  | "forecast_lead_hours"
  | "signed_error_mw"
  | "abs_error_mw"
  | "data_status";

type SortDirection = "asc" | "desc";

const statusTone: Record<DataAvailability, "success" | "warning" | "danger" | "neutral"> = {
  matched: "success",
  actual_only: "warning",
  forecast_only: "warning",
  missing: "danger",
};

function SortButton({
  label,
  field,
  sortField,
  direction,
  onSort,
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
}) {
  const active = sortField === field;
  const Icon = active ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={`inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.12em] transition-colors ${
        active ? "text-ghost" : "text-steel hover:text-ghost"
      }`}
      aria-label={`Sort by ${label}`}
    >
      {label}
      <Icon className="h-3 w-3" aria-hidden="true" />
    </button>
  );
}

function compareValues(a: RecordRow, b: RecordRow, field: SortField): number {
  const left = a[field];
  const right = b[field];
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right));
}

export function ExplorerPage() {
  const { params, paramsKey, selection } = useDashboard();
  const [startDate, setStartDate] = useState(PERIOD_START);
  const [endDate, setEndDate] = useState(PERIOD_END);
  const [appliedDates, setAppliedDates] = useState({
    start_date: PERIOD_START,
    end_date: PERIOD_END,
  });
  const [dateError, setDateError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | DataAvailability>("all");
  const [sortField, setSortField] = useState<SortField>("delivery_start");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data, error, loading, reload } = useApi(
    (signal) => api.records(params, appliedDates, signal),
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
    setPage(1);
    setAppliedDates({ start_date: startDate, end_date: endDate });
  }

  function changeSort(field: SortField) {
    if (field === sortField) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setPage(1);
  }

  const filteredRows = useMemo(() => {
    if (!data) return [];
    const rows =
      statusFilter === "all"
        ? [...data.records]
        : data.records.filter((row) => row.data_status === statusFilter);
    rows.sort((a, b) => {
      const result = compareValues(a, b, sortField);
      return sortDirection === "asc" ? result : -result;
    });
    return rows;
  }, [data, statusFilter, sortField, sortDirection]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  function exportCsv() {
    if (!filteredRows.length) return;
    const suffix = selection.mode === "horizon" ? `${selection.horizonHours}h` : "latest";
    downloadCsv(
      `windsight-records-${appliedDates.start_date}-to-${appliedDates.end_date}-${suffix}.csv`,
      buildRecordsCsv(filteredRows),
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Record-level data"
        title="Data explorer"
        description="Sort and filter every half-hourly delivery interval, inspect matched and missing values, and export the currently filtered records. Hourly forecasts are repeated across both half-hours in their forecast hour."
        actions={
          <button
            type="button"
            onClick={exportCsv}
            disabled={!filteredRows.length}
            className="inline-flex items-center gap-2 rounded-control bg-ghost px-4 py-2.5 text-xs font-semibold text-void transition-colors hover:bg-bone disabled:cursor-not-allowed disabled:bg-graphite disabled:text-steel"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            Export filtered CSV
          </button>
        }
      />

      <Card className="p-5">
        <form onSubmit={applyDates} className="flex flex-col gap-3">
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
            <label className="block w-full sm:w-auto">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.14em] text-steel">
                Availability
              </span>
              <span className="relative block">
                <Filter
                  className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-steel"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as "all" | DataAvailability);
                    setPage(1);
                  }}
                  className="h-9 w-full rounded-control border border-graphite bg-carbon pl-8 pr-3 text-xs font-medium text-bone outline-none transition-colors hover:border-steel focus:border-lavender sm:w-auto"
                >
                  <option value="all">All availability states</option>
                  <option value="matched">Matched</option>
                  <option value="actual_only">Missing forecast</option>
                  <option value="forecast_only">Missing actual</option>
                  <option value="missing">Missing both</option>
                </select>
              </span>
            </label>
            <button
              type="submit"
              className="h-9 w-full rounded-control bg-ghost px-4 text-xs font-semibold text-void transition-colors hover:bg-bone sm:w-auto"
            >
              Apply dates
            </button>
            {dateError ? (
              <p className="text-[11px] font-medium text-danger" role="alert">
                {dateError}
              </p>
            ) : null}
          </div>
          <p className="text-[11px] leading-5 text-steel">
            {data
              ? `${formatNumber(filteredRows.length)} of ${formatNumber(data.records.length)} records shown. The CSV includes all filtered rows, not only this page.`
              : "The CSV includes all rows matching the current date and availability filters."}
          </p>
        </form>
      </Card>

      {loading ? <LoadingState label="Loading records" /> : null}
      {!loading && error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : null}

      {!loading && data ? (
        <>
          <DataStatusBar status={data.meta.data_status} />

          <Callout title="Hourly forecasts, half-hourly delivery">
            Each WINDFOR value is shown against both half-hourly settlement periods in its
            forecast hour. Missing actual or forecast generation is exported as an empty CSV
            cell, never zero.
          </Callout>

          <Card>
            <CardHeader
              title="Delivery interval records"
              description="One row per half-hourly delivery interval. Forecast lead time is delivery start minus publication time."
              action={
                <div className="flex flex-wrap gap-2">
                  <Badge tone="neutral">{formatNumber(data.records.length)} rows</Badge>
                  <Badge tone="accent">{formatNumber(filteredRows.length)} filtered</Badge>
                </div>
              }
            />
            {filteredRows.length ? (
              <>
                <p className="border-b border-graphite px-4 py-2 text-[10px] text-steel sm:hidden">
                  Scroll horizontally to inspect every field.
                </p>
                <div className="overflow-x-auto">
                  <table className="min-w-[1000px] text-left text-[11px]">
                    <thead className="border-b border-graphite bg-void">
                      <tr>
                        <th className="px-[7px] py-2.5" aria-sort={sortField === "delivery_start" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
                          <SortButton
                            label="Delivery (UTC)"
                            field="delivery_start"
                            sortField={sortField}
                            direction={sortDirection}
                            onSort={changeSort}
                          />
                        </th>
                        <th className="px-[7px] py-2.5 text-right" aria-sort={sortField === "actual_mw" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
                          <SortButton
                            label="Actual MW"
                            field="actual_mw"
                            sortField={sortField}
                            direction={sortDirection}
                            onSort={changeSort}
                          />
                        </th>
                        <th className="px-[7px] py-2.5 text-right" aria-sort={sortField === "forecast_mw" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
                          <SortButton
                            label="Forecast MW"
                            field="forecast_mw"
                            sortField={sortField}
                            direction={sortDirection}
                            onSort={changeSort}
                          />
                        </th>
                        <th className="px-[7px] py-2.5">
                          <span className="whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.12em] text-steel">
                            Forecast hour (UTC)
                          </span>
                        </th>
                        <th className="px-[7px] py-2.5" aria-sort={sortField === "forecast_publish_time" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
                          <SortButton
                            label="Published (UTC)"
                            field="forecast_publish_time"
                            sortField={sortField}
                            direction={sortDirection}
                            onSort={changeSort}
                          />
                        </th>
                        <th className="px-[7px] py-2.5 text-right" aria-sort={sortField === "forecast_lead_hours" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
                          <SortButton
                            label="Lead"
                            field="forecast_lead_hours"
                            sortField={sortField}
                            direction={sortDirection}
                            onSort={changeSort}
                          />
                        </th>
                        <th className="px-[7px] py-2.5 text-right" aria-sort={sortField === "signed_error_mw" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
                          <SortButton
                            label="Signed error MW"
                            field="signed_error_mw"
                            sortField={sortField}
                            direction={sortDirection}
                            onSort={changeSort}
                          />
                        </th>
                        <th className="px-[7px] py-2.5 text-right" aria-sort={sortField === "abs_error_mw" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
                          <SortButton
                            label="Abs error MW"
                            field="abs_error_mw"
                            sortField={sortField}
                            direction={sortDirection}
                            onSort={changeSort}
                          />
                        </th>
                        <th className="px-[7px] py-2.5" aria-sort={sortField === "data_status" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
                          <SortButton
                            label="Status"
                            field="data_status"
                            sortField={sortField}
                            direction={sortDirection}
                            onSort={changeSort}
                          />
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {pageRows.map((row) => (
                        <tr
                          key={row.delivery_start}
                          className="transition-colors hover:bg-white/[0.03]"
                        >
                          <td className="whitespace-nowrap px-4 py-2.5 font-medium text-bone">
                            {formatUtcTable(row.delivery_start)}
                          </td>
                          <td className="px-[7px] py-2.5 text-right tabular-nums text-ash">
                            {formatNumber(row.actual_mw)}
                          </td>
                          <td className="px-[7px] py-2.5 text-right tabular-nums text-ash">
                            {formatNumber(row.forecast_mw)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-ash">
                            {formatUtcTable(row.forecast_valid_time)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-ash">
                            {formatUtcTable(row.forecast_publish_time)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right text-ash">
                            {formatLeadHours(row.forecast_lead_hours)}
                          </td>
                          <td className="px-[7px] py-2.5 text-right tabular-nums text-ash">
                            {formatNumber(row.signed_error_mw)}
                          </td>
                          <td className="px-[7px] py-2.5 text-right tabular-nums text-ash">
                            {formatNumber(row.abs_error_mw)}
                          </td>
                          <td className="px-[7px] py-2.5">
                            <Badge tone={statusTone[row.data_status]}>
                              {dataStatusLabel(row.data_status)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-col gap-3 border-t border-graphite px-4 py-3 text-xs text-steel sm:flex-row sm:items-center sm:justify-between">
                  <p>
                    Page {formatNumber(safePage)} of {formatNumber(pageCount)} ·{" "}
                    {formatNumber(filteredRows.length)} filtered records
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={safePage <= 1}
                      className="inline-flex items-center gap-1 rounded-control border border-graphite bg-carbon px-3 py-1.5 font-medium text-ash transition-colors hover:border-steel hover:text-ghost disabled:cursor-not-allowed disabled:text-graphite"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                      disabled={safePage >= pageCount}
                      className="inline-flex items-center gap-1 rounded-control border border-graphite bg-carbon px-3 py-1.5 font-medium text-ash transition-colors hover:border-steel hover:text-ghost disabled:cursor-not-allowed disabled:text-graphite"
                    >
                      Next
                      <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-4">
                <EmptyState
                  title="No records match the current filters"
                  message="Change the delivery dates or availability filter. The CSV button is disabled when no rows are filtered."
                />
              </div>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
