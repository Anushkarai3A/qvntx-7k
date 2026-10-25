from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd

from app.analytics.selection import build_delivery_frame, select_forecasts
from tests.conftest import frame_actuals, frame_forecasts


def _deliveries() -> pd.DatetimeIndex:
    return pd.date_range(
        "2026-01-01T12:00:00Z", "2026-01-01T13:00:00Z", freq="30min", inclusive="left"
    )


def _versions() -> pd.DataFrame:
    return frame_forecasts(
        [
            ("2026-01-01T12:00:00Z", "2026-01-01T00:00:00Z", 100.0),
            ("2026-01-01T12:00:00Z", "2026-01-01T06:00:00Z", 110.0),
            ("2026-01-01T12:00:00Z", "2026-01-01T10:00:00Z", 120.0),
            ("2026-01-01T12:00:00Z", "2026-01-01T14:00:00Z", 999.0),
        ]
    )


def test_latest_selection_respects_explicit_cutoff():
    selected = select_forecasts(
        _versions(),
        _deliveries(),
        mode="latest",
        cutoff=datetime(2026, 1, 1, 11, tzinfo=timezone.utc),
    )
    assert len(selected) == 2
    assert set(selected["forecast_mw"]) == {120.0}
    assert set(selected["publish_time"]) == {pd.Timestamp("2026-01-01T10:00:00Z")}
    assert set(selected["forecast_valid_time"]) == {pd.Timestamp("2026-01-01T12:00:00Z")}


def test_latest_selection_uses_earlier_forecast_before_cutoff():
    selected = select_forecasts(
        _versions(),
        _deliveries(),
        mode="latest",
        cutoff=datetime(2026, 1, 1, 9, tzinfo=timezone.utc),
    )
    assert set(selected["forecast_mw"]) == {110.0}


def test_forecast_at_cutoff_is_eligible():
    selected = select_forecasts(
        _versions(),
        _deliveries(),
        mode="latest",
        cutoff=datetime(2026, 1, 1, 10, tzinfo=timezone.utc),
    )
    assert set(selected["forecast_mw"]) == {120.0}


def test_horizon_selection_uses_start_minus_horizon():
    selected = select_forecasts(
        _versions(),
        _deliveries(),
        mode="horizon",
        horizon_hours=6,
    )
    assert set(selected["forecast_mw"]) == {110.0}


def test_horizon_selection_changes_with_horizon():
    selected = select_forecasts(
        _versions(),
        _deliveries(),
        mode="horizon",
        horizon_hours=2,
    )
    assert set(selected["forecast_mw"]) == {120.0}


def test_no_forecast_when_cutoff_precedes_all_versions():
    selected = select_forecasts(
        _versions(),
        _deliveries(),
        mode="latest",
        cutoff=datetime(2025, 12, 31, tzinfo=timezone.utc),
    )
    assert selected.empty


def test_hourly_forecast_is_applied_to_both_half_hours():
    actuals = frame_actuals(
        [
            ("2026-01-01T12:00:00Z", 100.0),
            ("2026-01-01T12:30:00Z", 110.0),
        ]
    )
    forecasts = frame_forecasts(
        [("2026-01-01T12:00:00Z", "2026-01-01T10:00:00Z", 120.0)]
    )
    frame = build_delivery_frame(
        actuals,
        forecasts,
        start=datetime(2026, 1, 1, 12, tzinfo=timezone.utc),
        end=datetime(2026, 1, 1, 13, tzinfo=timezone.utc),
        mode="latest",
        cutoff=datetime(2026, 1, 1, 11, tzinfo=timezone.utc),
    )
    assert list(frame["data_status"]) == ["matched", "matched"]
    assert list(frame["forecast_mw"]) == [120.0, 120.0]
    assert list(frame["forecast_valid_time"]) == [
        pd.Timestamp("2026-01-01T12:00:00Z"),
        pd.Timestamp("2026-01-01T12:00:00Z"),
    ]
    assert list(frame["signed_error_mw"]) == [20.0, 10.0]


def test_missing_actual_is_not_treated_as_zero():
    actuals = frame_actuals([("2026-01-01T12:00:00Z", 100.0)])
    forecasts = frame_forecasts(
        [("2026-01-01T12:00:00Z", "2026-01-01T10:00:00Z", 120.0)]
    )
    frame = build_delivery_frame(
        actuals,
        forecasts,
        start=datetime(2026, 1, 1, 12, tzinfo=timezone.utc),
        end=datetime(2026, 1, 1, 13, tzinfo=timezone.utc),
        mode="latest",
        cutoff=datetime(2026, 1, 1, 11, tzinfo=timezone.utc),
    )
    assert list(frame["data_status"]) == ["matched", "forecast_only"]
    assert pd.isna(frame.iloc[1]["actual_mw"])
    assert pd.isna(frame.iloc[1]["signed_error_mw"])


def test_duplicate_forecast_versions_keep_latest_publication():
    forecasts = frame_forecasts(
        [
            ("2026-01-01T12:00:00Z", "2026-01-01T10:00:00Z", 120.0),
            ("2026-01-01T12:00:00Z", "2026-01-01T11:00:00Z", 125.0),
            ("2026-01-01T12:00:00Z", "2026-01-01T11:00:00Z", 126.0),
        ]
    )
    selected = select_forecasts(
        forecasts,
        _deliveries(),
        mode="latest",
        cutoff=datetime(2026, 1, 1, 12, tzinfo=timezone.utc),
    )
    assert selected.iloc[0]["forecast_mw"] == 126.0


def test_mode_requires_cutoff_or_horizon():
    import pytest

    from app.exceptions import WindSightError

    with pytest.raises(WindSightError):
        select_forecasts(_versions(), _deliveries(), mode="latest")
    with pytest.raises(WindSightError):
        select_forecasts(_versions(), _deliveries(), mode="horizon")

def test_hourly_forecast_does_not_cross_hour_boundaries():
    forecasts = frame_forecasts(
        [
            ("2026-01-01T11:00:00Z", "2026-01-01T09:00:00Z", 90.0),
            ("2026-01-01T12:00:00Z", "2026-01-01T10:00:00Z", 120.0),
        ]
    )
    deliveries = pd.date_range(
        "2026-01-01T11:30:00Z", "2026-01-01T13:00:00Z", freq="30min", inclusive="left"
    )
    selected = select_forecasts(
        forecasts,
        deliveries,
        mode="latest",
        cutoff=datetime(2026, 1, 1, 11, tzinfo=timezone.utc),
    )
    assert list(selected["forecast_mw"]) == [90.0, 120.0, 120.0]
    assert list(selected["forecast_valid_time"]) == [
        pd.Timestamp("2026-01-01T11:00:00Z"),
        pd.Timestamp("2026-01-01T12:00:00Z"),
        pd.Timestamp("2026-01-01T12:00:00Z"),
    ]


def test_each_half_hour_uses_its_own_horizon_cutoff():
    forecasts = frame_forecasts(
        [
            ("2026-01-01T12:00:00Z", "2026-01-01T04:00:00Z", 100.0),
            ("2026-01-01T12:00:00Z", "2026-01-01T06:00:00Z", 110.0),
            ("2026-01-01T12:00:00Z", "2026-01-01T07:00:00Z", 130.0),
        ]
    )
    deliveries = pd.date_range(
        "2026-01-01T12:00:00Z", "2026-01-01T13:00:00Z", freq="30min", inclusive="left"
    )
    selected = select_forecasts(
        forecasts,
        deliveries,
        mode="horizon",
        horizon_hours=5.5,
    )
    assert list(selected["forecast_mw"]) == [110.0, 130.0]

def test_empty_forecast_selection_preserves_missing_values_without_error():
    actuals = frame_actuals(
        [
            ("2026-01-01T12:00:00Z", 100.0),
            ("2026-01-01T12:30:00Z", 110.0),
        ]
    )
    forecasts = frame_forecasts(
        [("2026-01-01T12:00:00Z", "2026-01-01T10:00:00Z", 120.0)]
    )
    frame = build_delivery_frame(
        actuals,
        forecasts,
        start=datetime(2026, 1, 1, 12, tzinfo=timezone.utc),
        end=datetime(2026, 1, 1, 13, tzinfo=timezone.utc),
        mode="horizon",
        horizon_hours=72,
    )
    assert list(frame["data_status"]) == ["actual_only", "actual_only"]
    assert frame["forecast_mw"].isna().all()
    assert frame["publish_time"].isna().all()
