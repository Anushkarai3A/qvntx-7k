from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import pytest

from app.config import Settings
from app.services.data_service import WindData


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        cache_dir=tmp_path,
        cache_ttl_seconds=3600,
        cors_origins="http://localhost:5173",
        default_cutoff=datetime(2026, 2, 1, tzinfo=timezone.utc),
        default_horizon_hours=24,
    )


def frame_actuals(rows: list[tuple[str, float]]) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "start_time": pd.to_datetime([row[0] for row in rows], utc=True),
            "publish_time": pd.to_datetime(
                [row[0] for row in rows], utc=True
            )
            + pd.Timedelta(minutes=30),
            "generation": [row[1] for row in rows],
        }
    )


def frame_forecasts(rows: list[tuple[str, str, float]]) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "start_time": pd.to_datetime([row[0] for row in rows], utc=True),
            "publish_time": pd.to_datetime([row[1] for row in rows], utc=True),
            "generation": [row[2] for row in rows],
        }
    )


def synthetic_wind_data(
    actuals: pd.DataFrame | None = None,
    forecasts: pd.DataFrame | None = None,
) -> WindData:
    actuals = actuals if actuals is not None else frame_actuals(
        [
            ("2026-01-01T00:00:00Z", 100.0),
            ("2026-01-01T00:30:00Z", 120.0),
            ("2026-01-01T01:00:00Z", 140.0),
            ("2026-01-01T01:30:00Z", 160.0),
            ("2026-01-01T02:00:00Z", 180.0),
        ]
    )
    forecasts = forecasts if forecasts is not None else frame_forecasts(
        [
            ("2026-01-01T00:00:00Z", "2025-12-31T00:00:00Z", 110.0),
            ("2026-01-01T01:00:00Z", "2025-12-31T01:00:00Z", 150.0),
            ("2026-01-01T02:00:00Z", "2025-12-31T02:00:00Z", 170.0),
        ]
    )
    return WindData(
        actuals=actuals,
        forecasts=forecasts,
        retrieved_at=datetime(2026, 2, 2, tzinfo=timezone.utc),
        cache_state="fresh",
        retrieval_source="cache",
        warnings=[],
    )
