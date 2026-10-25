export type SelectionMode = "latest" | "horizon";
export type DataAvailability = "matched" | "actual_only" | "forecast_only" | "missing";
export type EligibilityStatus = "eligible" | "no_eligible_forecast";

export interface DataStatus {
  source: string;
  retrieved_at: string;
  cache_state: "fresh" | "stale";
  retrieval_source: "upstream" | "cache";
  actual_records: number;
  forecast_records: number;
  invalid_actual_records: number;
  invalid_forecast_records: number;
  warnings: string[];
}

export interface AnalysisMeta {
  generated_at: string;
  period_start: string;
  period_end: string;
  delivery_start: string;
  delivery_end: string;
  mode: SelectionMode;
  cutoff: string | null;
  horizon_hours: number | null;
  timezone: string;
  expected_intervals: number;
  data_status: DataStatus;
}

export interface CoverageStats {
  expected_intervals: number;
  actual_observations: number;
  selected_forecasts: number;
  matched_observations: number;
  missing_actuals: number;
  missing_eligible_forecasts: number;
  data_coverage_pct: number | null;
  actual_coverage_pct: number | null;
  forecast_coverage_pct: number | null;
}

export interface MetricSet {
  matched_observations: number;
  mean_error_mw: number | null;
  mae_mw: number | null;
  rmse_mw: number | null;
  wape_pct: number | null;
  max_abs_error_mw: number | null;
}

export interface SeriesPoint {
  delivery_start: string;
  delivery_date: string;
  interval_label: string;
  actual_mw: number | null;
  forecast_mw: number | null;
  forecast_valid_time: string | null;
  forecast_publish_time: string | null;
  forecast_lead_hours: number | null;
  signed_error_mw: number | null;
  abs_error_mw: number | null;
  eligibility_status: EligibilityStatus;
  data_status: DataAvailability;
}

export interface GroupMetrics {
  label: string;
  sort_key: string;
  matched_observations: number;
  mean_error_mw: number | null;
  mae_mw: number | null;
  rmse_mw: number | null;
  wape_pct: number | null;
  max_abs_error_mw: number | null;
}

export interface LatestForecastKpi {
  delivery_start: string;
  forecast_mw: number;
  publish_time: string;
  forecast_lead_hours: number;
  actual_mw: number | null;
  signed_error_mw: number | null;
}

export interface LatestActualKpi {
  delivery_start: string;
  actual_mw: number;
}

export interface OverviewResponse {
  meta: AnalysisMeta;
  coverage: CoverageStats;
  metrics: MetricSet;
  latest_eligible_forecast: LatestForecastKpi | null;
  latest_actual: LatestActualKpi | null;
  series: SeriesPoint[];
  by_date: GroupMetrics[];
}

export interface AccuracyResponse {
  meta: AnalysisMeta;
  coverage: CoverageStats;
  metrics: MetricSet;
  series: SeriesPoint[];
  by_date: GroupMetrics[];
  by_interval: GroupMetrics[];
  by_horizon: GroupMetrics[];
}

export interface RecordRow {
  delivery_start: string;
  delivery_date: string;
  interval_label: string;
  actual_mw: number | null;
  forecast_mw: number | null;
  forecast_valid_time: string | null;
  forecast_publish_time: string | null;
  forecast_lead_hours: number | null;
  signed_error_mw: number | null;
  abs_error_mw: number | null;
  eligibility_status: EligibilityStatus;
  data_status: DataAvailability;
  published_before_delivery: boolean | null;
}

export interface RecordsResponse {
  meta: AnalysisMeta;
  coverage: CoverageStats;
  total_records: number;
  records: RecordRow[];
}

export interface ForecastVersion {
  publish_time: string;
  forecast_mw: number;
  forecast_lead_hours: number;
  published_before_delivery: boolean;
  eligible_at_cutoff: boolean;
  is_selected: boolean;
  signed_error_mw: number | null;
  abs_error_mw: number | null;
}

export interface ForecastHistoryResponse {
  meta: AnalysisMeta;
  delivery_start: string;
  forecast_valid_time: string;
  actual_mw: number | null;
  decision_cutoff: string;
  horizon_hours: number | null;
  selected_publish_time: string | null;
  selected_forecast_mw: number | null;
  versions: ForecastVersion[];
}

export interface DataQualityDiagnostics {
  actual_records: number;
  forecast_records: number;
  forecast_versions_for_period: number;
  expected_intervals: number;
  invalid_actual_records: number;
  invalid_forecast_records: number;
  duplicate_actual_records: number;
  duplicate_forecast_records: number;
  actual_resolution_minutes: number | null;
  forecast_resolution_hours: number | null;
}

export interface DataQualityResponse {
  meta: AnalysisMeta;
  coverage: CoverageStats;
  diagnostics: DataQualityDiagnostics;
}

export interface HealthResponse {
  status: "ok";
  service: string;
  environment: string;
  data_loaded: boolean;
}
