from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.exceptions import DataUnavailableError
from app.main import create_app
from app.services.analysis_service import AnalysisService
from tests.conftest import frame_forecasts, synthetic_wind_data


class FakeDataService:
    def __init__(self, data):
        self.data = data

    async def get_data(self, force_refresh: bool = False):
        return self.data


class FailingDataService:
    async def get_data(self, force_refresh: bool = False):
        raise DataUnavailableError("Synthetic upstream outage")


def make_client(settings: Settings, data_service) -> TestClient:
    app = create_app(settings)
    app.state.data_service = data_service
    app.state.analysis_service = AnalysisService(settings, data_service)
    return TestClient(app)


@pytest.fixture
def api_client(settings: Settings):
    data = synthetic_wind_data()
    return make_client(settings, FakeDataService(data))


def test_health(api_client: TestClient):
    response = api_client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_overview_response_schema_and_units(api_client: TestClient):
    response = api_client.get(
        "/api/overview",
        params={
            "start_date": "2026-01-01",
            "end_date": "2026-01-01",
            "mode": "horizon",
            "horizon_hours": 6,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["meta"]["expected_intervals"] == 48
    assert payload["meta"]["mode"] == "horizon"
    assert payload["meta"]["timezone"] == "UTC"
    assert len(payload["series"]) == 48
    assert payload["coverage"]["matched_observations"] == 5
    assert payload["metrics"]["mae_mw"] == pytest.approx(10.0, abs=0.001)
    assert payload["latest_eligible_forecast"]["forecast_mw"] == 170.0
    assert payload["latest_actual"]["actual_mw"] == 180.0


def test_accuracy_groups_and_missing_counts(api_client: TestClient):
    response = api_client.get(
        "/api/accuracy",
        params={
            "start_date": "2026-01-01",
            "end_date": "2026-01-01",
            "cutoff": "2026-01-02T00:00:00Z",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["coverage"]["missing_eligible_forecasts"] == 42
    assert payload["coverage"]["missing_actuals"] == 43
    assert payload["by_date"][0]["matched_observations"] == 5
    assert payload["by_horizon"][0]["label"] == "24-48h"
    assert payload["metrics"]["wape_pct"] is not None


def test_forecast_history_eligibility_and_selection(settings: Settings):
    forecasts = frame_forecasts(
        [
            ("2026-01-01T12:00:00Z", "2026-01-01T00:00:00Z", 100.0),
            ("2026-01-01T12:00:00Z", "2026-01-01T06:00:00Z", 110.0),
            ("2026-01-01T12:00:00Z", "2026-01-01T10:00:00Z", 120.0),
            ("2026-01-01T12:00:00Z", "2026-01-01T14:00:00Z", 999.0),
        ]
    )
    data = synthetic_wind_data(
        actuals=synthetic_wind_data().actuals,
        forecasts=forecasts,
    )
    client = make_client(settings, FakeDataService(data))
    response = client.get(
        "/api/forecast-history",
        params={
            "delivery_start": "2026-01-01T12:00:00Z",
            "mode": "latest",
            "cutoff": "2026-01-01T11:00:00Z",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert len(payload["versions"]) == 4
    assert payload["selected_publish_time"] == "2026-01-01T10:00:00Z"
    assert payload["selected_forecast_mw"] == 120.0
    assert payload["actual_mw"] is None
    selected = [row for row in payload["versions"] if row["is_selected"]]
    assert len(selected) == 1
    assert selected[0]["eligible_at_cutoff"] is True
    assert payload["versions"][-1]["eligible_at_cutoff"] is False


def test_records_preserve_null_values(api_client: TestClient):
    response = api_client.get(
        "/api/records",
        params={
            "start_date": "2026-01-01",
            "end_date": "2026-01-01",
            "cutoff": "2026-01-02T00:00:00Z",
        },
    )
    assert response.status_code == 200
    records = response.json()["records"]
    assert len(records) == 48
    missing = [row for row in records if row["data_status"] == "missing"]
    forecast_only = [row for row in records if row["data_status"] == "forecast_only"]
    assert len(missing) == 42
    assert len(forecast_only) == 1
    assert all(row["actual_mw"] is None and row["forecast_mw"] is None for row in missing)
    assert all(
        row["actual_mw"] is None and row["forecast_mw"] is not None
        for row in forecast_only
    )


def test_invalid_date_range_returns_400(api_client: TestClient):
    response = api_client.get(
        "/api/overview",
        params={"start_date": "2025-12-31", "end_date": "2026-01-01"},
    )
    assert response.status_code == 400
    assert response.json()["error"] == "invalid_request"


def test_reversed_date_range_returns_400(api_client: TestClient):
    response = api_client.get(
        "/api/overview",
        params={"start_date": "2026-01-02", "end_date": "2026-01-01"},
    )
    assert response.status_code == 400


def test_unsupported_horizon_returns_400(api_client: TestClient):
    response = api_client.get(
        "/api/accuracy",
        params={"mode": "horizon", "horizon_hours": 100},
    )
    assert response.status_code == 400
    assert "horizon_hours" in response.json()["detail"]


def test_naive_cutoff_rejected(api_client: TestClient):
    response = api_client.get(
        "/api/overview",
        params={"mode": "latest", "cutoff": "2026-01-01T00:00:00"},
    )
    assert response.status_code == 400
    assert "timezone" in response.json()["detail"].lower()


def test_upstream_failure_returns_503(settings: Settings):
    client = make_client(settings, FailingDataService())
    response = client.get("/api/overview")
    assert response.status_code == 503
    assert response.json()["error"] == "data_unavailable"


def test_data_quality(api_client: TestClient):
    response = api_client.get(
        "/api/data-quality",
        params={"start_date": "2026-01-01", "end_date": "2026-01-01"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["diagnostics"]["actual_resolution_minutes"] == 30
    assert payload["diagnostics"]["forecast_resolution_hours"] == 1
    assert payload["coverage"]["expected_intervals"] == 48

def test_forecast_history_for_half_past_uses_containing_forecast_hour(settings: Settings):
    forecasts = frame_forecasts(
        [
            ("2026-01-01T12:00:00Z", "2026-01-01T00:00:00Z", 100.0),
            ("2026-01-01T12:00:00Z", "2026-01-01T06:00:00Z", 110.0),
            ("2026-01-01T12:00:00Z", "2026-01-01T10:00:00Z", 120.0),
        ]
    )
    data = synthetic_wind_data(forecasts=forecasts)
    client = make_client(settings, FakeDataService(data))
    response = client.get(
        "/api/forecast-history",
        params={
            "delivery_start": "2026-01-01T12:30:00Z",
            "mode": "latest",
            "cutoff": "2026-01-01T11:00:00Z",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["forecast_valid_time"] == "2026-01-01T12:00:00Z"
    assert len(payload["versions"]) == 3
    assert payload["selected_forecast_mw"] == 120.0
    selected = [row for row in payload["versions"] if row["is_selected"]]
    assert len(selected) == 1
    assert selected[0]["forecast_lead_hours"] == 2.5

def test_horizon_without_eligible_forecasts_returns_empty_metrics(api_client: TestClient):
    response = api_client.get(
        "/api/overview",
        params={
            "start_date": "2026-01-01",
            "end_date": "2026-01-01",
            "mode": "horizon",
            "horizon_hours": 72,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["coverage"]["matched_observations"] == 0
    assert payload["coverage"]["actual_observations"] == 5
    assert payload["metrics"]["mae_mw"] is None
    assert payload["meta"]["data_status"]["warnings"]

def test_non_finite_horizon_returns_400(api_client: TestClient):
    for value in ("nan", "NaN", "inf", "-inf"):
        response = api_client.get(
            "/api/overview",
            params={"mode": "horizon", "horizon_hours": value},
        )
        assert response.status_code == 400, value
        assert response.json()["error"] == "invalid_request"

def test_malformed_query_returns_structured_400(api_client: TestClient):
    for params in (
        {"start_date": "not-a-date"},
        {"mode": "bogus"},
        {"horizon_hours": "abc"},
    ):
        response = api_client.get("/api/overview", params=params)
        assert response.status_code == 400, params
        payload = response.json()
        assert payload["error"] == "invalid_request"
        assert payload["detail"]

