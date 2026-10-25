from __future__ import annotations

import pandas as pd

from app.services.parsing import parse_actuals, parse_forecasts


def test_actual_duplicates_keep_latest_publication():
    parsed = parse_actuals(
        [
            {
                "dataset": "FUELHH",
                "startTime": "2026-01-01T00:00:00Z",
                "publishTime": "2026-01-01T00:30:00Z",
                "fuelType": "WIND",
                "generation": 100,
            },
            {
                "dataset": "FUELHH",
                "startTime": "2026-01-01T00:00:00Z",
                "publishTime": "2026-01-01T01:00:00Z",
                "fuelType": "WIND",
                "generation": 105,
            },
        ]
    )
    assert len(parsed.frame) == 1
    assert parsed.frame.iloc[0]["generation"] == 105
    assert parsed.duplicates_removed == 1


def test_missing_generation_is_rejected_not_zeroed():
    parsed = parse_actuals(
        [
            {
                "dataset": "FUELHH",
                "startTime": "2026-01-01T00:00:00Z",
                "publishTime": "2026-01-01T00:30:00Z",
                "fuelType": "WIND",
                "generation": None,
            }
        ]
    )
    assert parsed.frame.empty
    assert parsed.missing_generation == 1


def test_naive_timestamps_are_rejected():
    parsed = parse_forecasts(
        [
            {
                "dataset": "WINDFOR",
                "startTime": "2026-01-01T00:00:00",
                "publishTime": "2025-12-31T00:00:00Z",
                "generation": 100,
            }
        ]
    )
    assert parsed.frame.empty
    assert parsed.invalid_records == 1


def test_forecast_duplicate_rows_are_deduplicated():
    parsed = parse_forecasts(
        [
            {
                "dataset": "WINDFOR",
                "startTime": "2026-01-01T00:00:00Z",
                "publishTime": "2025-12-31T00:00:00Z",
                "generation": 100,
            },
            {
                "dataset": "WINDFOR",
                "startTime": "2026-01-01T00:00:00Z",
                "publishTime": "2025-12-31T00:00:00Z",
                "generation": 101,
            },
        ]
    )
    assert len(parsed.frame) == 1
    assert parsed.frame.iloc[0]["generation"] == 101
    assert parsed.duplicates_removed == 1


def test_utc_normalization_preserves_instant():
    parsed = parse_forecasts(
        [
            {
                "dataset": "WINDFOR",
                "startTime": "2026-01-01T01:00:00+01:00",
                "publishTime": "2025-12-31T23:00:00Z",
                "generation": 100,
            }
        ]
    )
    assert parsed.frame.iloc[0]["start_time"] == pd.Timestamp("2026-01-01T00:00:00Z")
    assert parsed.frame.iloc[0]["start_time"].tzinfo is not None

def test_non_finite_generation_is_rejected():
    actuals = parse_actuals(
        [
            {
                "dataset": "FUELHH",
                "startTime": "2026-01-01T00:00:00Z",
                "publishTime": "2026-01-01T00:30:00Z",
                "fuelType": "WIND",
                "generation": float("inf"),
            }
        ]
    )
    assert actuals.frame.empty
    assert actuals.invalid_records == 1

    forecasts = parse_forecasts(
        [
            {
                "dataset": "WINDFOR",
                "startTime": "2026-01-01T00:00:00Z",
                "publishTime": "2025-12-31T00:00:00Z",
                "generation": float("nan"),
            }
        ]
    )
    assert forecasts.frame.empty
    assert forecasts.invalid_records == 1

