from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_ROOT = Path(__file__).resolve().parents[1]


def _require_aware(value: datetime, field_name: str) -> datetime:
    if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
        raise ValueError(f"{field_name} must include a timezone offset (for example Z or +00:00)")
    return value.astimezone(timezone.utc)


class Settings(BaseSettings):
    """Application configuration supplied through environment variables."""

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        allow_inf_nan=False,
    )

    app_name: str = "WindSight UK API"
    environment: str = "development"
    api_prefix: str = "/api"

    elexon_base_url: str = "https://data.elexon.co.uk/bmrs/api/v1"
    request_timeout_seconds: float = Field(default=30.0, gt=0)
    max_retries: int = Field(default=3, ge=0, le=8)
    retry_backoff_seconds: float = Field(default=1.0, ge=0)
    upstream_window_days: int = Field(default=7, ge=1, le=7)

    cache_dir: Path = BACKEND_ROOT / "data" / "cache"
    cache_ttl_seconds: int = Field(default=24 * 60 * 60, ge=0)

    analysis_start: datetime = datetime(2026, 1, 1, tzinfo=timezone.utc)
    analysis_end: datetime = datetime(2026, 2, 1, tzinfo=timezone.utc)
    forecast_history_start: datetime = datetime(2025, 12, 28, tzinfo=timezone.utc)
    forecast_history_end: datetime = datetime(2026, 2, 1, tzinfo=timezone.utc)
    default_cutoff: datetime = datetime(2026, 2, 1, tzinfo=timezone.utc)
    default_horizon_hours: float = Field(default=24.0, gt=0, le=72)
    max_horizon_hours: float = Field(default=72.0, gt=0, le=168)
    min_horizon_hours: float = Field(default=0.5, gt=0)

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"

    @field_validator(
        "analysis_start",
        "analysis_end",
        "forecast_history_start",
        "forecast_history_end",
        "default_cutoff",
        mode="after",
    )
    @classmethod
    def validate_timezone_aware(cls, value: datetime) -> datetime:
        return _require_aware(value, "datetime setting")

    @field_validator("cache_dir", mode="before")
    @classmethod
    def resolve_path(cls, value: str | Path) -> Path:
        path = Path(value)
        if not path.is_absolute():
            path = BACKEND_ROOT / path
        return path

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def analysis_start_date(self) -> date:
        return self.analysis_start.date()

    @property
    def analysis_end_date(self) -> date:
        return (self.analysis_end - timedelta(microseconds=1)).date()


@lru_cache
def get_settings() -> Settings:
    return Settings()
