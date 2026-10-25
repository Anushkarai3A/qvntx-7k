import type { RecordRow } from "../types/api";
import { dataStatusLabel, eligibilityLabel } from "./format";

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && FORMULA_PREFIX.test(text)) {
    text = `'${text}`;
  }
  if (/[",\n\r\t]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildRecordsCsv(records: RecordRow[]): string {
  const headers = [
    "Delivery timestamp (UTC)",
    "Actual generation (MW)",
    "Selected forecast (MW)",
    "Forecast valid hour (UTC)",
    "Forecast published (UTC)",
    "Forecast lead time (hours)",
    "Signed error F-A (MW)",
    "Absolute error (MW)",
    "Availability",
    "Forecast eligibility",
    "Published before delivery",
  ];

  const rows = records.map((record) => [
    record.delivery_start,
    record.actual_mw,
    record.forecast_mw,
    record.forecast_valid_time,
    record.forecast_publish_time,
    record.forecast_lead_hours,
    record.signed_error_mw,
    record.abs_error_mw,
    dataStatusLabel(record.data_status),
    eligibilityLabel(record.eligibility_status),
    record.published_before_delivery === null
      ? ""
      : record.published_before_delivery
        ? "yes"
        : "no",
  ]);

  return [headers, ...rows]
    .map((row) => row.map(escapeCell).join(","))
    .join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
