from __future__ import annotations

import math

import numpy as np
import pandas as pd

from app.analytics.metrics import compute_coverage, compute_metrics, group_accuracy


def _frame() -> pd.DataFrame:
    times = pd.to_datetime(
        ["2026-01-01T00:00:00Z", "2026-01-01T00:30:00Z", "2026-01-01T01:00:00Z"],
        utc=True,
    )
    return pd.DataFrame(
        {
            "start_time": times,
            "delivery_date": [t.date() for t in times],
            "interval_label": ["00:00", "00:30", "01:00"],
            "actual_mw": [100.0, 200.0, None],
            "forecast_mw": [110.0, 180.0, 300.0],
            "forecast_publish_time": pd.to_datetime(
                ["2025-12-31T00:00:00Z"] * 3, utc=True
            ),
            "forecast_lead_hours": [24.0, 24.0, 24.0],
            "signed_error_mw": [10.0, -20.0, np.nan],
            "abs_error_mw": [10.0, 20.0, np.nan],
            "eligibility_status": ["eligible"] * 3,
            "data_status": ["matched", "matched", "forecast_only"],
            "published_before_delivery": [True, True, True],
            "horizon_bucket": ["12-24h", "12-24h", "12-24h"],
        }
    )


def test_metrics_use_matched_observations_only():
    metrics = compute_metrics(_frame())
    assert metrics.matched_observations == 2
    assert metrics.mean_error_mw == -5.0
    assert metrics.mae_mw == 15.0
    assert round(metrics.rmse_mw or 0, 3) == round(math.sqrt(250), 3)
    assert round(metrics.wape_pct or 0, 3) == 10.0
    assert metrics.max_abs_error_mw == 20.0


def test_missing_actual_is_not_zero_in_wape():
    only_missing_actual = _frame().iloc[[2]]
    metrics = compute_metrics(only_missing_actual)
    assert metrics.matched_observations == 0
    assert metrics.wape_pct is None
    assert metrics.mae_mw is None


def test_wape_undefined_when_actual_total_is_zero():
    frame = _frame().iloc[[0]].copy()
    frame["actual_mw"] = 0.0
    frame["signed_error_mw"] = 10.0
    metrics = compute_metrics(frame)
    assert metrics.wape_pct is None
    assert metrics.mae_mw == 10.0


def test_coverage_counts_missing_not_as_observations():
    coverage = compute_coverage(_frame(), expected_intervals=4)
    assert coverage.actual_observations == 2
    assert coverage.selected_forecasts == 3
    assert coverage.matched_observations == 2
    assert coverage.missing_actuals == 2
    assert coverage.missing_eligible_forecasts == 1
    assert coverage.data_coverage_pct == 50.0
    assert coverage.actual_coverage_pct == 50.0
    assert coverage.forecast_coverage_pct == 75.0


def test_groups_by_date_interval_and_horizon():
    frame = _frame()
    assert group_accuracy(frame, "date")[0].label == "2026-01-01"
    assert group_accuracy(frame, "interval")[0].label == "00:00"
    horizon = group_accuracy(frame, "horizon")
    assert horizon[0].label == "12-24h"
    assert horizon[0].matched_observations == 2
