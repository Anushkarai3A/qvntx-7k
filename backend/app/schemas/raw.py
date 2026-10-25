from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from pydantic import BaseModel, ConfigDict, field_validator


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
        raise ValueError("Elexon timestamps must include a timezone offset")
    return value.astimezone(timezone.utc)


class ElexonActualRecord(BaseModel):
    """Validated FUELHH WIND row used by the ingestion layer."""

    model_config = ConfigDict(extra="ignore", allow_inf_nan=False)

    dataset: str | None = None
    startTime: datetime
    publishTime: datetime | None = None
    settlementDate: date | None = None
    settlementPeriod: int | None = None
    fuelType: str | None = None
    generation: float | None = None

    @field_validator("startTime", "publishTime")
    @classmethod
    def normalize_timestamp(cls, value: datetime | None) -> datetime | None:
        return _as_utc(value) if value is not None else None

    @field_validator("fuelType")
    @classmethod
    def normalize_fuel_type(cls, value: str | None) -> str | None:
        return value.upper() if value else value

    def to_normalized(self) -> dict[str, Any]:
        return {
            "start_time": self.startTime.isoformat(),
            "publish_time": self.publishTime.isoformat() if self.publishTime else None,
            "settlement_date": self.settlementDate.isoformat() if self.settlementDate else None,
            "settlement_period": self.settlementPeriod,
            "fuel_type": self.fuelType,
            "generation": self.generation,
        }


class ElexonForecastRecord(BaseModel):
    """Validated WINDFOR row used by the ingestion layer."""

    model_config = ConfigDict(extra="ignore", allow_inf_nan=False)

    dataset: str | None = None
    startTime: datetime
    publishTime: datetime
    generation: float | None = None

    @field_validator("startTime", "publishTime")
    @classmethod
    def normalize_timestamp(cls, value: datetime) -> datetime:
        return _as_utc(value)

    def to_normalized(self) -> dict[str, Any]:
        return {
            "start_time": self.startTime.isoformat(),
            "publish_time": self.publishTime.isoformat(),
            "generation": self.generation,
        }
