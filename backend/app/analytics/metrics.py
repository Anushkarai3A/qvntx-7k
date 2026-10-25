from __future__ import annotations

import math
from typing import Literal

import numpy as np
import pandas as pd

from app.schemas.responses import CoverageStats, GroupMetrics, MetricSet

GroupBy = Literal["date", "interval", "horizon"]

HORIZON_ORDER = [
    "Post-delivery (<0h)",
    "0-3h",
    "3-6h",
    "6-12h",
    "12-24h",
    "24-48h",
    ">48h",
    "Unknown",
]


def _clean_float(value: float | np.floating | None) -> float | None:
    if value is None:
        return None
    numeric = float(value)
    if not math.isfinite(numeric):
        return None
    return numeric


def _pct(numerator: int, denominator: int) -> float | None:
    if denominator <= 0:
        return None
    return round(numerator / denominator * 100.0, 2)


def matched_observations(frame: pd.DataFrame) -> pd.DataFrame:
    """Return rows with both a valid actual and forecast. Missing is not zero."""
    if frame.empty:
        return frame.iloc[0:0]
    return frame[frame["actual_mw"].notna() & frame["forecast_mw"].notna()].copy()


def compute_metrics(frame: pd.DataFrame) -> MetricSet:
    matched = matched_observations(frame)
    count = int(len(matched))
    if count == 0:
        return MetricSet(
            matched_observations=0,
            mean_error_mw=None,
            mae_mw=None,
            rmse_mw=None,
            wape_pct=None,
            max_abs_error_mw=None,
        )

    errors = pd.to_numeric(matched["signed_error_mw"], errors="coerce").dropna()
    actual = pd.to_numeric(matched["actual_mw"], errors="coerce")
    absolute_errors = errors.abs()

    denominator = float(actual.abs().sum())
    wape = (
        float(absolute_errors.sum()) / denominator * 100.0
        if denominator > 0 and math.isfinite(denominator)
        else None
    )

    return MetricSet(
        matched_observations=count,
        mean_error_mw=round(float(errors.mean()), 3),
        mae_mw=round(float(absolute_errors.mean()), 3),
        rmse_mw=round(float(np.sqrt(np.mean(np.square(errors.to_numpy())))), 3),
        wape_pct=round(wape, 3) if wape is not None else None,
        max_abs_error_mw=round(float(absolute_errors.max()), 3),
    )


def compute_coverage(frame: pd.DataFrame, expected_intervals: int) -> CoverageStats:
    actual_count = int(frame["actual_mw"].notna().sum())
    forecast_count = int(frame["forecast_mw"].notna().sum())
    matched_count = int(
        (frame["actual_mw"].notna() & frame["forecast_mw"].notna()).sum()
    )
    return CoverageStats(
        expected_intervals=expected_intervals,
        actual_observations=actual_count,
        selected_forecasts=forecast_count,
        matched_observations=matched_count,
        missing_actuals=max(expected_intervals - actual_count, 0),
        missing_eligible_forecasts=max(expected_intervals - forecast_count, 0),
        data_coverage_pct=_pct(matched_count, expected_intervals),
        actual_coverage_pct=_pct(actual_count, expected_intervals),
        forecast_coverage_pct=_pct(forecast_count, expected_intervals),
    )


def _group_metrics(group: pd.DataFrame) -> dict[str, float | int | None]:
    metrics = compute_metrics(group)
    return {
        "matched_observations": metrics.matched_observations,
        "mean_error_mw": metrics.mean_error_mw,
        "mae_mw": metrics.mae_mw,
        "rmse_mw": metrics.rmse_mw,
        "wape_pct": metrics.wape_pct,
        "max_abs_error_mw": metrics.max_abs_error_mw,
    }


def group_accuracy(frame: pd.DataFrame, group_by: GroupBy) -> list[GroupMetrics]:
    matched = matched_observations(frame)
    if matched.empty:
        return []

    if group_by == "date":
        matched = matched.assign(_label=matched["delivery_date"].astype(str))
        sort_key = lambda value: str(value)  # noqa: E731
    elif group_by == "interval":
        matched = matched.assign(_label=matched["interval_label"].astype(str))
        sort_key = lambda value: str(value)  # noqa: E731
    elif group_by == "horizon":
        matched = matched.assign(_label=matched["horizon_bucket"].astype(str))
        order = {label: index for index, label in enumerate(HORIZON_ORDER)}
        sort_key = lambda value: f"{order.get(str(value), 99):02d}"  # noqa: E731
    else:
        raise ValueError(f"Unsupported grouping: {group_by}")

    result: list[GroupMetrics] = []
    for label, group in matched.groupby("_label", dropna=False, sort=False):
        label_text = str(label)
        result.append(
            GroupMetrics(
                label=label_text,
                sort_key=sort_key(label_text),
                **_group_metrics(group),
            )
        )

    return sorted(result, key=lambda item: item.sort_key)


def attach_horizon_bucket(frame: pd.DataFrame) -> pd.DataFrame:
    from app.analytics.selection import horizon_bucket

    result = frame.copy()
    result["horizon_bucket"] = result["forecast_lead_hours"].apply(horizon_bucket)
    return result
