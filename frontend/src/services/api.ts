import type {
  AccuracyResponse,
  DataQualityResponse,
  ForecastHistoryResponse,
  HealthResponse,
  OverviewResponse,
  RecordsResponse,
  SelectionMode,
} from "../types/api";

const configuredBase = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
export const API_BASE_URL = (
  configuredBase || (import.meta.env.DEV ? "http://localhost:8000" : "")
).replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;

function buildUrl(path: string, params?: QueryParams): string {
  const search = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        search.set(key, String(value));
      }
    });
  }
  const query = search.toString();
  return `${API_BASE_URL}${path}${query ? `?${query}` : ""}`;
}

async function request<T>(
  path: string,
  params?: QueryParams,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path, params), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    const endpoint =
      API_BASE_URL || (typeof window !== "undefined" ? window.location.origin : "the API");
    throw new ApiError(
      `Could not reach the WindSight API at ${endpoint}. Check that the backend is running and VITE_API_URL is configured.`,
      0,
      "network_error",
    );
  }

  if (!response.ok) {
    let detail = `The API returned HTTP ${response.status}.`;
    let code: string | undefined;
    try {
      const payload = (await response.json()) as { detail?: unknown; error?: string };
      if (typeof payload.detail === "string") detail = payload.detail;
      else if (Array.isArray(payload.detail)) {
        detail = payload.detail
          .map((item) => {
            if (typeof item === "object" && item && "msg" in item) {
              return String((item as { msg: unknown }).msg);
            }
            return String(item);
          })
          .join("; ");
      }
      code = payload.error;
    } catch {
      code = undefined;
    }
    throw new ApiError(detail, response.status, code);
  }

  return (await response.json()) as T;
}

export interface SelectionParams {
  mode: SelectionMode;
  cutoff?: string;
  horizon_hours?: number;
}

export interface DateParams {
  start_date?: string;
  end_date?: string;
}

export const api = {
  overview(selection: SelectionParams, dates: DateParams, signal?: AbortSignal) {
    return request<OverviewResponse>("/api/overview", { ...selection, ...dates }, signal);
  },
  accuracy(selection: SelectionParams, dates: DateParams, signal?: AbortSignal) {
    return request<AccuracyResponse>("/api/accuracy", { ...selection, ...dates }, signal);
  },
  records(selection: SelectionParams, dates: DateParams, signal?: AbortSignal) {
    return request<RecordsResponse>("/api/records", { ...selection, ...dates }, signal);
  },
  forecastHistory(
    selection: SelectionParams,
    deliveryStart?: string,
    signal?: AbortSignal,
  ) {
    return request<ForecastHistoryResponse>(
      "/api/forecast-history",
      { ...selection, delivery_start: deliveryStart },
      signal,
    );
  },
  dataQuality(selection: SelectionParams, dates: DateParams, signal?: AbortSignal) {
    return request<DataQualityResponse>("/api/data-quality", { ...selection, ...dates }, signal);
  },
  health(signal?: AbortSignal) {
    return request<HealthResponse>("/health", undefined, signal);
  },
};
