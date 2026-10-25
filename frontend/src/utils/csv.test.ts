import { describe, expect, it } from "vitest";

import type { RecordRow } from "../types/api";
import { buildRecordsCsv } from "./csv";

const rows: RecordRow[] = [
  {
    delivery_start: "2026-01-01T00:00:00+00:00",
    delivery_date: "2026-01-01",
    interval_label: "00:00",
    actual_mw: 100,
    forecast_mw: 110,
    forecast_valid_time: "2026-01-01T00:00:00+00:00",
    forecast_publish_time: "2025-12-31T00:00:00+00:00",
    forecast_lead_hours: 24,
    signed_error_mw: 10,
    abs_error_mw: 10,
    eligibility_status: "eligible",
    data_status: "matched",
    published_before_delivery: true,
  },
  {
    delivery_start: "2026-01-01T00:30:00+00:00",
    delivery_date: "2026-01-01",
    interval_label: "00:30",
    actual_mw: null,
    forecast_mw: null,
    forecast_valid_time: null,
    forecast_publish_time: null,
    forecast_lead_hours: null,
    signed_error_mw: null,
    abs_error_mw: null,
    eligibility_status: "no_eligible_forecast",
    data_status: "missing",
    published_before_delivery: null,
  },
];

describe("CSV export", () => {
  it("exports filtered rows with headers and units", () => {
    const csv = buildRecordsCsv(rows);
    const lines = csv.split("\r\n");
    expect(lines[0]).toContain("Actual generation (MW)");
    expect(lines[0]).toContain("Forecast lead time (hours)");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("100,110");
    expect(lines[1]).toContain("Matched");
  });

  it("neutralises spreadsheet formulas without altering numeric cells", () => {
    const malicious = {
      ...rows[0],
      delivery_start: '=HYPERLINK("https://example.invalid","click")',
      interval_label: "+cmd|test",
    } as RecordRow;
    const csv = buildRecordsCsv([malicious]);
    expect(csv.split("\r\n")[1]).toContain("'=HYPERLINK");
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m);
    const numeric = buildRecordsCsv([{ ...rows[0], actual_mw: -50 }]);
    expect(numeric.split("\r\n")[1]).toContain("-50");
    expect(numeric).not.toContain("'-50");
  });

  it("preserves missing values as empty cells rather than zero", () => {
    const csv = buildRecordsCsv(rows);
    const missingRow = csv.split("\r\n")[2];
    expect(missingRow).toContain("2026-01-01T00:30:00+00:00,,,");
    expect(missingRow).toContain("Missing both");
  });
});
