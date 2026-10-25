import { describe, expect, it } from "vitest";

import {
  formatLeadHours,
  formatMw,
  formatNumber,
  formatPct,
  formatUtcDateTime,
  utcInputToIso,
} from "./format";

describe("format utilities", () => {
  it("formats MW values and handles nulls", () => {
    expect(formatMw(1234.4)).toContain("1,234");
    expect(formatMw(null)).toBe("—");
    expect(formatNumber(0)).toBe("0");
    expect(formatPct(null)).toBe("—");
    expect(formatPct(12.345)).toBe("12.3%");
  });

  it("formats lead time before and after delivery", () => {
    expect(formatLeadHours(24)).toBe("24h before");
    expect(formatLeadHours(6.5)).toBe("6h 30m before");
    expect(formatLeadHours(-2)).toBe("2h after");
    expect(formatLeadHours(null)).toBe("—");
  });

  it("displays timestamps explicitly as UTC", () => {
    expect(formatUtcDateTime("2026-01-01T12:00:00Z")).toContain("UTC");
    expect(formatUtcDateTime("2026-01-01T12:00:00Z")).toContain("12:00");
  });

  it("converts a UTC datetime-local value to ISO", () => {
    expect(utcInputToIso("2026-02-01T00:00")).toBe("2026-02-01T00:00:00Z");
  });
});
