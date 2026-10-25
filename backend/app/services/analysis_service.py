from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone

import pandas as pd

from app.analytics.metrics import compute_coverage, compute_metrics, group_accuracy
from app.analytics.selection import build_delivery_frame
from app.config import Settings
from app.exceptions import InvalidRequestError, WindSightError
from app.schemas.responses import (
    AccuracyResponse,
    ActualPoint,
    ActualsResponse,
    AnalysisMeta,
    CoverageStats,
    DataQualityDiagnostics,
    DataQualityResponse,
    DataStatus,
    ForecastHistoryResponse,
    ForecastPoint,
    ForecastsResponse,
    ForecastVersion,
    GroupMetrics,
    LatestActualKpi,
    LatestForecastKpi,
    MetricSet,
    OverviewResponse,
    RecordRow,
    RecordsResponse,
    SeriesPoint,
)
from app.services.data_service import SOURCE_LABEL, DataService, WindData


@dataclass
class Evaluation:
    period_start: date
    period_end: date
    delivery_start: datetime
    delivery_end: datetime
    expected_intervals: int
    mode: str
    cutoff: datetime | None
    horizon_hours: float | None
    frame: pd.DataFrame
    coverage: CoverageStats
    metrics: MetricSet
    data: WindData


def _as_utc(value: datetime, field_name: str) -> datetime:
    if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
        raise InvalidRequestError(f"{field_name} must include a timezone (for example Z)")
    return value.astimezone(timezone.utc)


def _float(value) -> float | None:
    if value is None or pd.isna(value):
        return None
    numeric = float(value)
    return numeric if math.isfinite(numeric) else None


def _timestamp(value) -> datetime | None:
    if value is None or pd.isna(value):
        return None
    return pd.Timestamp(value).to_pydatetime()


class AnalysisService:
    def __init__(self, settings: Settings, data_service: DataService):
        self.settings = settings
        self.data_service = data_service

    def resolve_period(
        self,
        start_date: date | None,
        end_date: date | None,
    ) -> tuple[date, date, datetime, datetime, int]:
        period_start = start_date or self.settings.analysis_start_date
        period_end = end_date or self.settings.analysis_end_date

        if period_start > period_end:
            raise InvalidRequestError("start_date must be on or before end_date")
        if period_start < self.settings.analysis_start_date or period_end > self.settings.analysis_end_date:
            raise InvalidRequestError(
                "Delivery dates must fall within the January 2026 analysis window "
                f"({self.settings.analysis_start_date} to {self.settings.analysis_end_date})"
            )

        delivery_start = datetime.combine(period_start, time.min, tzinfo=timezone.utc)
        delivery_end = datetime.combine(period_end + timedelta(days=1), time.min, tzinfo=timezone.utc)
        expected = int((delivery_end - delivery_start).total_seconds() / 1800)
        return period_start, period_end, delivery_start, delivery_end, expected

    def resolve_selection(
        self,
        mode: str,
        cutoff: datetime | None,
        horizon_hours: float | None,
    ) -> tuple[datetime | None, float | None]:
        if mode == "latest":
            effective_cutoff = _as_utc(cutoff or self.settings.default_cutoff, "cutoff")
            return effective_cutoff, None
        if mode == "horizon":
            horizon = float(horizon_hours if horizon_hours is not None else self.settings.default_horizon_hours)
            if not math.isfinite(horizon):
                raise InvalidRequestError("horizon_hours must be a finite number")
            if horizon < self.settings.min_horizon_hours or horizon > self.settings.max_horizon_hours:
                raise InvalidRequestError(
                    f"horizon_hours must be between {self.settings.min_horizon_hours} "
                    f"and {self.settings.max_horizon_hours}"
                )
            return None, horizon
        raise InvalidRequestError("mode must be either 'latest' or 'horizon'")

    async def evaluate(
        self,
        start_date: date | None,
        end_date: date | None,
        mode: str,
        cutoff: datetime | None,
        horizon_hours: float | None,
    ) -> Evaluation:
        period_start, period_end, delivery_start, delivery_end, expected = self.resolve_period(
            start_date, end_date
        )
        effective_cutoff, effective_horizon = self.resolve_selection(mode, cutoff, horizon_hours)
        data = await self.data_service.get_data()

        frame = build_delivery_frame(
            data.actuals,
            data.forecasts,
            start=delivery_start,
            end=delivery_end,
            mode=mode,
            cutoff=effective_cutoff,
            horizon_hours=effective_horizon,
        )
        coverage = compute_coverage(frame, expected)
        metrics = compute_metrics(frame)
        return Evaluation(
            period_start=period_start,
            period_end=period_end,
            delivery_start=delivery_start,
            delivery_end=delivery_end,
            expected_intervals=expected,
            mode=mode,
            cutoff=effective_cutoff,
            horizon_hours=effective_horizon,
            frame=frame,
            coverage=coverage,
            metrics=metrics,
            data=data,
        )

    def build_meta(self, evaluation: Evaluation) -> AnalysisMeta:
        warnings = list(evaluation.data.warnings)
        selected = evaluation.frame[evaluation.frame["forecast_mw"].notna()]
        published_before = selected["published_before_delivery"].astype("boolean").fillna(False)
        post_delivery = int((~published_before).sum())
        if evaluation.mode == "latest" and post_delivery:
            warnings.append(
                f"{post_delivery} selected forecasts were published after their delivery "
                "interval started because the cutoff permits post-delivery publications. "
                "Use Horizon mode to enforce a decision lead time."
            )
        if evaluation.coverage.matched_observations == 0:
            warnings.append("No matched actual/forecast observations exist for this selection.")

        status = DataStatus(
            source=SOURCE_LABEL,
            retrieved_at=evaluation.data.retrieved_at,
            cache_state=evaluation.data.cache_state,
            retrieval_source=evaluation.data.retrieval_source,
            actual_records=evaluation.data.actual_records,
            forecast_records=evaluation.data.forecast_records,
            invalid_actual_records=evaluation.data.invalid_actual_records,
            invalid_forecast_records=evaluation.data.invalid_forecast_records,
            warnings=list(dict.fromkeys(warnings)),
        )
        return AnalysisMeta(
            generated_at=datetime.now(timezone.utc),
            period_start=evaluation.period_start,
            period_end=evaluation.period_end,
            delivery_start=evaluation.delivery_start,
            delivery_end=evaluation.delivery_end,
            mode=evaluation.mode,
            cutoff=evaluation.cutoff,
            horizon_hours=evaluation.horizon_hours,
            expected_intervals=evaluation.expected_intervals,
            data_status=status,
        )

    def frame_to_series(self, frame: pd.DataFrame) -> list[SeriesPoint]:
        points: list[SeriesPoint] = []
        for row in frame.itertuples(index=False):
            points.append(
                SeriesPoint(
                    delivery_start=pd.Timestamp(row.start_time).to_pydatetime(),
                    delivery_date=row.delivery_date,
                    interval_label=str(row.interval_label),
                    actual_mw=_float(row.actual_mw),
                    forecast_mw=_float(row.forecast_mw),
                    forecast_valid_time=_timestamp(row.forecast_valid_time),
                    forecast_publish_time=_timestamp(row.publish_time),
                    forecast_lead_hours=_float(row.forecast_lead_hours),
                    signed_error_mw=_float(row.signed_error_mw),
                    abs_error_mw=_float(row.abs_error_mw),
                    eligibility_status=str(row.eligibility_status),
                    data_status=str(row.data_status),
                )
            )
        return points

    def group_all(self, frame: pd.DataFrame) -> tuple[list[GroupMetrics], list[GroupMetrics], list[GroupMetrics]]:
        return (
            group_accuracy(frame, "date"),
            group_accuracy(frame, "interval"),
            group_accuracy(frame, "horizon"),
        )

    async def overview(
        self,
        start_date: date | None,
        end_date: date | None,
        mode: str,
        cutoff: datetime | None,
        horizon_hours: float | None,
    ) -> OverviewResponse:
        evaluation = await self.evaluate(start_date, end_date, mode, cutoff, horizon_hours)
        meta = self.build_meta(evaluation)
        frame = evaluation.frame

        forecasts = frame[frame["forecast_mw"].notna()].sort_values("start_time")
        latest_forecast = None
        if not forecasts.empty:
            row = forecasts.iloc[-1]
            actual = _float(row["actual_mw"])
            forecast = float(row["forecast_mw"])
            latest_forecast = LatestForecastKpi(
                delivery_start=pd.Timestamp(row["start_time"]).to_pydatetime(),
                forecast_mw=forecast,
                publish_time=pd.Timestamp(row["publish_time"]).to_pydatetime(),
                forecast_lead_hours=float(row["forecast_lead_hours"]),
                actual_mw=actual,
                signed_error_mw=(forecast - actual) if actual is not None else None,
            )

        actuals = frame[frame["actual_mw"].notna()].sort_values("start_time")
        latest_actual = None
        if not actuals.empty:
            row = actuals.iloc[-1]
            latest_actual = LatestActualKpi(
                delivery_start=pd.Timestamp(row["start_time"]).to_pydatetime(),
                actual_mw=float(row["actual_mw"]),
            )

        return OverviewResponse(
            meta=meta,
            coverage=evaluation.coverage,
            metrics=evaluation.metrics,
            latest_eligible_forecast=latest_forecast,
            latest_actual=latest_actual,
            series=self.frame_to_series(frame),
            by_date=group_accuracy(frame, "date"),
        )

    async def accuracy(
        self,
        start_date: date | None,
        end_date: date | None,
        mode: str,
        cutoff: datetime | None,
        horizon_hours: float | None,
    ) -> AccuracyResponse:
        evaluation = await self.evaluate(start_date, end_date, mode, cutoff, horizon_hours)
        by_date, by_interval, by_horizon = self.group_all(evaluation.frame)
        return AccuracyResponse(
            meta=self.build_meta(evaluation),
            coverage=evaluation.coverage,
            metrics=evaluation.metrics,
            series=self.frame_to_series(evaluation.frame),
            by_date=by_date,
            by_interval=by_interval,
            by_horizon=by_horizon,
        )

    async def records(
        self,
        start_date: date | None,
        end_date: date | None,
        mode: str,
        cutoff: datetime | None,
        horizon_hours: float | None,
    ) -> RecordsResponse:
        evaluation = await self.evaluate(start_date, end_date, mode, cutoff, horizon_hours)
        rows: list[RecordRow] = []
        for row in evaluation.frame.itertuples(index=False):
            rows.append(
                RecordRow(
                    delivery_start=pd.Timestamp(row.start_time).to_pydatetime(),
                    delivery_date=row.delivery_date,
                    interval_label=str(row.interval_label),
                    actual_mw=_float(row.actual_mw),
                    forecast_mw=_float(row.forecast_mw),
                    forecast_valid_time=_timestamp(row.forecast_valid_time),
                    forecast_publish_time=_timestamp(row.publish_time),
                    forecast_lead_hours=_float(row.forecast_lead_hours),
                    signed_error_mw=_float(row.signed_error_mw),
                    abs_error_mw=_float(row.abs_error_mw),
                    eligibility_status=str(row.eligibility_status),
                    data_status=str(row.data_status),
                    published_before_delivery=(
                        bool(row.published_before_delivery)
                        if row.published_before_delivery is not None and not pd.isna(row.published_before_delivery)
                        else None
                    ),
                )
            )
        return RecordsResponse(
            meta=self.build_meta(evaluation),
            coverage=evaluation.coverage,
            total_records=len(rows),
            records=rows,
        )

    async def actuals(
        self,
        start_date: date | None,
        end_date: date | None,
        mode: str,
        cutoff: datetime | None,
        horizon_hours: float | None,
    ) -> ActualsResponse:
        evaluation = await self.evaluate(start_date, end_date, mode, cutoff, horizon_hours)
        data = evaluation.data.actuals
        rows = data[
            (data["start_time"] >= pd.Timestamp(evaluation.delivery_start))
            & (data["start_time"] < pd.Timestamp(evaluation.delivery_end))
        ].sort_values("start_time")
        records = [
            ActualPoint(
                delivery_start=pd.Timestamp(row.start_time).to_pydatetime(),
                publish_time=_timestamp(row.publish_time),
                generation_mw=float(row.generation),
            )
            for row in rows.itertuples(index=False)
        ]
        return ActualsResponse(
            meta=self.build_meta(evaluation),
            total_records=len(records),
            records=records,
        )

    async def forecasts(
        self,
        start_date: date | None,
        end_date: date | None,
        mode: str,
        cutoff: datetime | None,
        horizon_hours: float | None,
    ) -> ForecastsResponse:
        evaluation = await self.evaluate(start_date, end_date, mode, cutoff, horizon_hours)
        selected = evaluation.frame[evaluation.frame["forecast_mw"].notna()].sort_values(
            "start_time"
        )
        records = [
            ForecastPoint(
                delivery_start=pd.Timestamp(row.start_time).to_pydatetime(),
                forecast_valid_time=pd.Timestamp(row.forecast_valid_time).to_pydatetime(),
                publish_time=pd.Timestamp(row.publish_time).to_pydatetime(),
                forecast_mw=float(row.forecast_mw),
                forecast_lead_hours=float(row.forecast_lead_hours),
            )
            for row in selected.itertuples(index=False)
        ]
        return ForecastsResponse(
            meta=self.build_meta(evaluation),
            total_records=len(records),
            records=records,
        )

    async def forecast_history(
        self,
        delivery_start: datetime | None,
        mode: str,
        cutoff: datetime | None,
        horizon_hours: float | None,
    ) -> ForecastHistoryResponse:
        effective_cutoff, effective_horizon = self.resolve_selection(mode, cutoff, horizon_hours)
        data = await self.data_service.get_data()

        if delivery_start is None:
            default_eval = await self.evaluate(
                None,
                None,
                mode,
                cutoff,
                horizon_hours,
            )
            candidates = default_eval.frame[default_eval.frame["forecast_mw"].notna()]
            if candidates.empty:
                raise InvalidRequestError(
                    "No eligible forecast is available; supply a delivery_start explicitly"
                )
            selected_start = pd.Timestamp(candidates["start_time"].max()).to_pydatetime()
        else:
            selected_start = _as_utc(delivery_start, "delivery_start")
            if not (
                self.settings.analysis_start <= selected_start < self.settings.analysis_end
            ):
                raise InvalidRequestError(
                    "delivery_start must fall within the January 2026 delivery window"
                )
            minute = selected_start.minute
            if minute not in (0, 30) or selected_start.second or selected_start.microsecond:
                raise InvalidRequestError("delivery_start must be a half-hourly interval boundary")

        if mode == "horizon":
            assert effective_horizon is not None
            decision_cutoff = selected_start - timedelta(hours=effective_horizon)
        else:
            assert effective_cutoff is not None
            decision_cutoff = effective_cutoff

        actual_rows = data.actuals[data.actuals["start_time"] == pd.Timestamp(selected_start)]
        actual_mw = _float(actual_rows.iloc[-1]["generation"]) if not actual_rows.empty else None

        forecast_valid_time = pd.Timestamp(selected_start).floor("h")
        forecast_hours = pd.to_datetime(data.forecasts["start_time"], utc=True).dt.floor("h")
        versions_frame = data.forecasts[
            forecast_hours == forecast_valid_time
        ].sort_values("publish_time")

        selected_publish = None
        selected_forecast = None
        if not versions_frame.empty:
            eligible_versions = versions_frame[
                versions_frame["publish_time"] <= pd.Timestamp(decision_cutoff)
            ]
            if not eligible_versions.empty:
                selected_publish = pd.Timestamp(
                    eligible_versions["publish_time"].max()
                ).to_pydatetime()
                selected_forecast = float(
                    eligible_versions.sort_values("publish_time").iloc[-1]["generation"]
                )

        versions: list[ForecastVersion] = []
        for row in versions_frame.itertuples(index=False):
            publish_time = pd.Timestamp(row.publish_time).to_pydatetime()
            forecast = float(row.generation)
            is_selected = selected_publish is not None and publish_time == selected_publish
            error = forecast - actual_mw if actual_mw is not None else None
            versions.append(
                ForecastVersion(
                    publish_time=publish_time,
                    forecast_mw=forecast,
                    forecast_lead_hours=round(
                        (selected_start - publish_time).total_seconds() / 3600.0, 4
                    ),
                    published_before_delivery=publish_time <= selected_start,
                    eligible_at_cutoff=publish_time <= decision_cutoff,
                    is_selected=is_selected,
                    signed_error_mw=error,
                    abs_error_mw=abs(error) if error is not None else None,
                )
            )

        period_eval = await self.evaluate(None, None, mode, cutoff, horizon_hours)
        meta = self.build_meta(period_eval)
        meta.cutoff = decision_cutoff
        meta.horizon_hours = effective_horizon
        meta.delivery_start = selected_start
        meta.delivery_end = selected_start + timedelta(minutes=30)

        return ForecastHistoryResponse(
            meta=meta,
            delivery_start=selected_start,
            forecast_valid_time=forecast_valid_time.to_pydatetime(),
            actual_mw=actual_mw,
            decision_cutoff=decision_cutoff,
            horizon_hours=effective_horizon,
            selected_publish_time=selected_publish,
            selected_forecast_mw=selected_forecast,
            versions=versions,
        )

    async def data_quality(
        self,
        start_date: date | None,
        end_date: date | None,
        mode: str,
        cutoff: datetime | None,
        horizon_hours: float | None,
    ) -> DataQualityResponse:
        evaluation = await self.evaluate(start_date, end_date, mode, cutoff, horizon_hours)
        data = evaluation.data
        return DataQualityResponse(
            meta=self.build_meta(evaluation),
            coverage=evaluation.coverage,
            diagnostics=DataQualityDiagnostics(
                actual_records=data.actual_records,
                forecast_records=data.forecast_records,
                forecast_versions_for_period=len(data.forecasts),
                expected_intervals=evaluation.expected_intervals,
                invalid_actual_records=data.invalid_actual_records,
                invalid_forecast_records=data.invalid_forecast_records,
                duplicate_actual_records=data.duplicate_actual_records,
                duplicate_forecast_records=data.duplicate_forecast_records,
                actual_resolution_minutes=data.actual_resolution_minutes,
                forecast_resolution_hours=data.forecast_resolution_hours,
            ),
        )
