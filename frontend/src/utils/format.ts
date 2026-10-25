import type { DataAvailability, EligibilityStatus, SelectionMode } from "../types/api";

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (decimals === 0) return numberFormatter.format(value);
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value);
}

export function formatMw(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${formatNumber(value)} MW`;
}

export function formatSignedMw(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatNumber(value)} MW`;
}

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${decimalFormatter.format(value)}%`;
}

export function formatUtcDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)} UTC`;
}

export function formatUtcDateTimeShort(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatUtcTable(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatUtcDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatLeadHours(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (value === 0) return "At delivery";
  const absolute = Math.abs(value);
  const hours = Math.floor(absolute);
  const minutes = Math.round((absolute - hours) * 60);
  const amount = minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  return value > 0 ? `${amount} before` : `${amount} after`;
}

export function formatHorizonLabel(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Latest available";
  return `${formatNumber(value, value % 1 === 0 ? 0 : 1)}h before delivery`;
}

export function formatMode(mode: SelectionMode): string {
  return mode === "horizon" ? "Forecast horizon" : "Latest available";
}

export function dataStatusLabel(status: DataAvailability): string {
  switch (status) {
    case "matched":
      return "Matched";
    case "actual_only":
      return "Missing forecast";
    case "forecast_only":
      return "Missing actual";
    case "missing":
      return "Missing both";
  }
}

export function eligibilityLabel(status: EligibilityStatus): string {
  return status === "eligible" ? "Eligible" : "No eligible forecast";
}

export function toUtcInputValue(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 16);
}

export function utcInputToIso(value: string): string {
  if (!value) return "";
  if (value.length === 16) return `${value}:00Z`;
  if (value.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(value)) return value;
  return `${value}Z`;
}

export function toDateInputValue(value: string): string {
  return value.slice(0, 10);
}

export function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
