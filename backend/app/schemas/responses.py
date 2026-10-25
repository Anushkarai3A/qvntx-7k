from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


SelectionMode = Literal["latest", "horizon"]
DataAvailability = Literal["matched", "actual_only", "forecast_only", "missing"]
EligibilityStatus = Literal["eligible", "no_eligible_forecast"]


class DataStatus(BaseModel):
    source: str
    retrieved_at: datetime
    cache_state: Literal["fresh", "stale"]
    retrieval_source: Literal["upstream", "cache"]
    actual_records: int
    forecast_records: int
    invalid_actual_records: int
    invalid_forecast_records: int
    warnings: list[str] = Field(default_factory=list)


class AnalysisMeta(BaseModel):
    generated_at: datetime
    period_start: date
    period_end: date
    delivery_start: datetime
    delivery_end: datetime
    mode: SelectionMode
    cutoff: datetime | None = None
    horizon_hours: float | None = None
    timezone: str = "UTC"
    expected_intervals: int
    data_status: DataStatus


class CoverageStats(BaseModel):
    expected_intervals: int
    actual_observations: int
    selected_forecasts: int
    matched_observations: int
    missing_actuals: int
    missing_eligible_forecasts: int
    data_coverage_pct: float | None
    actual_coverage_pct: float | None
    forecast_coverage_pct: float | None


class MetricSet(BaseModel):
    matched_observations: int
    mean_error_mw: float | None
    mae_mw: float | None
    rmse_mw: float | None
    wape_pct: float | None
    max_abs_error_mw: float | None


class SeriesPoint(BaseModel):
    delivery_start: datetime
    delivery_date: date
    interval_label: str
    actual_mw: float | None
    forecast_mw: float | None
    forecast_valid_time: datetime | None
    forecast_publish_time: datetime | None
    forecast_lead_hours: float | None
    signed_error_mw: float | None
    abs_error_mw: float | None
    eligibility_status: EligibilityStatus
    data_status: DataAvailability


class GroupMetrics(BaseModel):
    label: str
    sort_key: str
    matched_observations: int
    mean_error_mw: float | None
    mae_mw: float | None
    rmse_mw: float | None
    wape_pct: float | None
    max_abs_error_mw: float | None


class LatestForecastKpi(BaseModel):
    delivery_start: datetime
    forecast_mw: float
    publish_time: datetime
    forecast_lead_hours: float
    actual_mw: float | None
    signed_error_mw: float | None


class LatestActualKpi(BaseModel):
    delivery_start: datetime
    actual_mw: float


class OverviewResponse(BaseModel):
    meta: AnalysisMeta
    coverage: CoverageStats
    metrics: MetricSet
    latest_eligible_forecast: LatestForecastKpi | None
    latest_actual: LatestActualKpi | None
    series: list[SeriesPoint]
    by_date: list[GroupMetrics]


class AccuracyResponse(BaseModel):
    meta: AnalysisMeta
    coverage: CoverageStats
    metrics: MetricSet
    series: list[SeriesPoint]
    by_date: list[GroupMetrics]
    by_interval: list[GroupMetrics]
    by_horizon: list[GroupMetrics]


class RecordRow(BaseModel):
    delivery_start: datetime
    delivery_date: date
    interval_label: str
    actual_mw: float | None
    forecast_mw: float | None
    forecast_valid_time: datetime | None
    forecast_publish_time: datetime | None
    forecast_lead_hours: float | None
    signed_error_mw: float | None
    abs_error_mw: float | None
    eligibility_status: EligibilityStatus
    data_status: DataAvailability
    published_before_delivery: bool | None


class RecordsResponse(BaseModel):
    meta: AnalysisMeta
    coverage: CoverageStats
    total_records: int
    records: list[RecordRow]


class ActualPoint(BaseModel):
    delivery_start: datetime
    publish_time: datetime | None
    generation_mw: float


class ActualsResponse(BaseModel):
    meta: AnalysisMeta
    total_records: int
    records: list[ActualPoint]


class ForecastPoint(BaseModel):
    delivery_start: datetime
    forecast_valid_time: datetime
    publish_time: datetime
    forecast_mw: float
    forecast_lead_hours: float


class ForecastsResponse(BaseModel):
    meta: AnalysisMeta
    total_records: int
    records: list[ForecastPoint]


class ForecastVersion(BaseModel):
    publish_time: datetime
    forecast_mw: float
    forecast_lead_hours: float
    published_before_delivery: bool
    eligible_at_cutoff: bool
    is_selected: bool
    signed_error_mw: float | None
    abs_error_mw: float | None


class ForecastHistoryResponse(BaseModel):
    meta: AnalysisMeta
    delivery_start: datetime
    forecast_valid_time: datetime
    actual_mw: float | None
    decision_cutoff: datetime
    horizon_hours: float | None
    selected_publish_time: datetime | None
    selected_forecast_mw: float | None
    versions: list[ForecastVersion]


class DataQualityDiagnostics(BaseModel):
    actual_records: int
    forecast_records: int
    forecast_versions_for_period: int
    expected_intervals: int
    invalid_actual_records: int
    invalid_forecast_records: int
    duplicate_actual_records: int
    duplicate_forecast_records: int
    actual_resolution_minutes: int | None
    forecast_resolution_hours: int | None


class DataQualityResponse(BaseModel):
    meta: AnalysisMeta
    coverage: CoverageStats
    diagnostics: DataQualityDiagnostics


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    environment: str
    data_loaded: bool
