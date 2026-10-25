from __future__ import annotations

import asyncio
import json
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

import pandas as pd

from app.config import Settings
from app.exceptions import DataUnavailableError, IncompleteDataError, UpstreamDataError
from app.services.elexon_client import ElexonClient
from app.services.parsing import ParsedDataset, parse_actuals, parse_forecasts

logger = logging.getLogger(__name__)

CACHE_VERSION = 1
SOURCE_LABEL = "Elexon BMRS (FUELHH WIND actuals; WINDFOR forecasts)"
RESOLUTION_WARNING = (
    "WINDFOR forecasts are hourly while FUELHH actuals are half-hourly. "
    "Each hourly forecast is applied to both half-hourly settlement periods in "
    "its hour; no sub-hourly forecast resolution is implied."
)


@dataclass
class WindData:
    actuals: pd.DataFrame
    forecasts: pd.DataFrame
    retrieved_at: datetime
    cache_state: Literal["fresh", "stale"]
    retrieval_source: Literal["upstream", "cache"]
    invalid_actual_records: int = 0
    invalid_forecast_records: int = 0
    duplicate_actual_records: int = 0
    duplicate_forecast_records: int = 0
    warnings: list[str] = field(default_factory=list)

    @property
    def actual_records(self) -> int:
        return int(len(self.actuals))

    @property
    def forecast_records(self) -> int:
        return int(len(self.forecasts))

    @property
    def actual_resolution_minutes(self) -> int | None:
        if self.actuals.empty:
            return None
        diffs = self.actuals["start_time"].sort_values().diff().dropna()
        if diffs.empty:
            return None
        return int(round(diffs.dt.total_seconds().median() / 60))

    @property
    def forecast_resolution_hours(self) -> int | None:
        if self.forecasts.empty:
            return None
        starts = self.forecasts["start_time"].drop_duplicates().sort_values()
        diffs = starts.diff().dropna()
        if diffs.empty:
            return None
        return int(round(diffs.dt.total_seconds().median() / 3600))


def _parse_utc(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("Cache retrieval timestamp is not timezone-aware")
    return parsed.astimezone(timezone.utc)


class DataService:
    """Loads, validates, caches and exposes the WindSight datasets.

    The upstream is contacted at most once per dataset per cache lifetime.
    API handlers read the in-memory DataFrames and never trigger a full
    upstream download on every request.
    """

    def __init__(self, settings: Settings, client: ElexonClient | None = None):
        self.settings = settings
        self.client = client or ElexonClient(settings)
        self._data: WindData | None = None
        self._lock = asyncio.Lock()

    @property
    def data_loaded(self) -> bool:
        return self._data is not None

    async def get_data(self, force_refresh: bool = False) -> WindData:
        if self._data is not None and not force_refresh:
            return self._data

        async with self._lock:
            if self._data is not None and not force_refresh:
                return self._data

            actuals, actual_meta = await self._load_actuals(force_refresh)
            forecasts, forecast_meta = await self._load_forecasts(force_refresh)

            expected_intervals = int(
                (self.settings.analysis_end - self.settings.analysis_start).total_seconds()
                / 1800
            )
            warnings: list[str] = [RESOLUTION_WARNING]
            warnings.extend(actual_meta["warnings"])
            warnings.extend(forecast_meta["warnings"])

            if actuals.empty:
                raise IncompleteDataError("No valid FUELHH WIND actual generation records were available")
            if forecasts.empty:
                raise IncompleteDataError("No valid WINDFOR forecast records were available")

            actual_coverage = len(actuals) / expected_intervals if expected_intervals else 0
            if actual_coverage < 0.5:
                raise IncompleteDataError(
                    f"FUELHH coverage is too incomplete: {len(actuals)} of "
                    f"{expected_intervals} expected half-hourly intervals"
                )
            if actual_coverage < 0.99:
                warnings.append(
                    f"Actual generation is missing for {expected_intervals - len(actuals)} "
                    "expected half-hourly intervals in January 2026."
                )
            if len(forecasts) < 100:
                warnings.append(
                    "The WINDFOR publication history contains relatively few forecast rows; "
                    "coverage is likely partial."
                )

            cache_state: Literal["fresh", "stale"] = (
                "stale"
                if "stale" in {actual_meta["cache_state"], forecast_meta["cache_state"]}
                else "fresh"
            )
            retrieval_source: Literal["upstream", "cache"] = (
                "upstream"
                if {actual_meta["retrieval_source"], forecast_meta["retrieval_source"]}
                == {"upstream"}
                else "cache"
            )

            self._data = WindData(
                actuals=actuals,
                forecasts=forecasts,
                retrieved_at=max(actual_meta["retrieved_at"], forecast_meta["retrieved_at"]),
                cache_state=cache_state,
                retrieval_source=retrieval_source,
                invalid_actual_records=actual_meta["invalid_records"],
                invalid_forecast_records=forecast_meta["invalid_records"],
                duplicate_actual_records=actual_meta["duplicates_removed"],
                duplicate_forecast_records=forecast_meta["duplicates_removed"],
                warnings=warnings,
            )
            return self._data

    async def _load_actuals(
        self, force_refresh: bool
    ) -> tuple[pd.DataFrame, dict]:
        cache_path = self._cache_path(
            "fuelhh_wind",
            self.settings.analysis_start_date.isoformat(),
            self.settings.analysis_end_date.isoformat(),
        )
        cache = self._read_cache(cache_path)
        if cache and not force_refresh and self._is_fresh(cache):
            parsed = parse_actuals(cache["records"])
            if not parsed.frame.empty:
                return self._filter_and_meta(
                    parsed,
                    cache["retrieved_at"],
                    "cache",
                    "fresh",
                    [],
                    cache_path,
                )

        try:
            result = await self.client.fetch_actuals(
                self.settings.analysis_start_date,
                self.settings.analysis_end_date,
            )
            parsed = parse_actuals(result.records)
            if parsed.frame.empty:
                raise IncompleteDataError("Elexon FUELHH returned no usable WIND records")
            retrieved_at = datetime.now(timezone.utc)
            self._write_cache(
                cache_path,
                "FUELHH",
                result.records,
                retrieved_at,
                self.settings.analysis_start.isoformat(),
                self.settings.analysis_end.isoformat(),
            )
            return self._filter_and_meta(
                parsed,
                retrieved_at,
                "upstream",
                "fresh",
                [],
                cache_path,
            )
        except (UpstreamDataError, IncompleteDataError) as exc:
            if cache:
                parsed = parse_actuals(cache["records"])
                if not parsed.frame.empty:
                    warning = (
                        "Live FUELHH retrieval failed; serving cached actuals retrieved "
                        f"at {cache['retrieved_at'].isoformat()} ({exc})."
                    )
                    logger.warning(warning)
                    return self._filter_and_meta(
                        parsed,
                        cache["retrieved_at"],
                        "cache",
                        "stale",
                        [warning],
                        cache_path,
                    )
            raise DataUnavailableError(
                f"FUELHH actual generation is unavailable and no usable cache exists: {exc}"
            ) from exc

    async def _load_forecasts(
        self, force_refresh: bool
    ) -> tuple[pd.DataFrame, dict]:
        cache_path = self._cache_path(
            "windfor",
            self.settings.forecast_history_start.date().isoformat(),
            self.settings.forecast_history_end.date().isoformat(),
        )
        cache = self._read_cache(cache_path)
        if cache and not force_refresh and self._is_fresh(cache):
            parsed = parse_forecasts(cache["records"])
            if not parsed.frame.empty:
                return self._filter_and_meta(
                    parsed,
                    cache["retrieved_at"],
                    "cache",
                    "fresh",
                    [],
                    cache_path,
                )

        try:
            result = await self.client.fetch_forecasts(
                self.settings.forecast_history_start,
                self.settings.forecast_history_end,
            )
            parsed = parse_forecasts(result.records)
            if parsed.frame.empty:
                raise IncompleteDataError("Elexon WINDFOR returned no usable forecast records")
            retrieved_at = datetime.now(timezone.utc)
            self._write_cache(
                cache_path,
                "WINDFOR",
                result.records,
                retrieved_at,
                self.settings.forecast_history_start.isoformat(),
                self.settings.forecast_history_end.isoformat(),
            )
            return self._filter_and_meta(
                parsed,
                retrieved_at,
                "upstream",
                "fresh",
                [],
                cache_path,
            )
        except (UpstreamDataError, IncompleteDataError) as exc:
            if cache:
                parsed = parse_forecasts(cache["records"])
                if not parsed.frame.empty:
                    warning = (
                        "Live WINDFOR retrieval failed; serving cached forecasts retrieved "
                        f"at {cache['retrieved_at'].isoformat()} ({exc})."
                    )
                    logger.warning(warning)
                    return self._filter_and_meta(
                        parsed,
                        cache["retrieved_at"],
                        "cache",
                        "stale",
                        [warning],
                        cache_path,
                    )
            raise DataUnavailableError(
                f"WINDFOR forecasts are unavailable and no usable cache exists: {exc}"
            ) from exc

    def _filter_and_meta(
        self,
        parsed: ParsedDataset,
        retrieved_at: datetime,
        retrieval_source: str,
        cache_state: str,
        warnings: list[str],
        cache_path: Path,
    ) -> tuple[pd.DataFrame, dict]:
        frame = parsed.frame.copy()
        frame = frame[
            (frame["start_time"] >= pd.Timestamp(self.settings.analysis_start))
            & (frame["start_time"] < pd.Timestamp(self.settings.analysis_end))
        ].reset_index(drop=True)

        invalid = parsed.invalid_records + parsed.missing_generation + parsed.wrong_fuel_type
        if invalid:
            warnings.append(
                f"Ignored {invalid} malformed or incomplete records from {cache_path.stem}."
            )

        return frame, {
            "retrieved_at": retrieved_at,
            "retrieval_source": retrieval_source,
            "cache_state": cache_state,
            "invalid_records": invalid,
            "duplicates_removed": parsed.duplicates_removed,
            "warnings": warnings,
        }

    def _cache_path(self, dataset: str, start: str, end: str) -> Path:
        return self.settings.cache_dir / f"{dataset}_{start}_{end}_v{CACHE_VERSION}.json"

    def _read_cache(self, path: Path) -> dict | None:
        if not path.exists():
            return None
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            if payload.get("version") != CACHE_VERSION:
                return None
            records = payload.get("records")
            if not isinstance(records, list):
                return None
            retrieved_at = _parse_utc(str(payload["retrieved_at"]))
            return {
                "records": records,
                "retrieved_at": retrieved_at,
            }
        except (OSError, ValueError, KeyError, TypeError):
            logger.warning("Ignoring unreadable cache file %s", path)
            return None

    def _is_fresh(self, cache: dict) -> bool:
        age = (datetime.now(timezone.utc) - cache["retrieved_at"]).total_seconds()
        return age <= self.settings.cache_ttl_seconds

    def _write_cache(
        self,
        path: Path,
        dataset: str,
        records: list[dict],
        retrieved_at: datetime,
        window_start: str,
        window_end: str,
    ) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": CACHE_VERSION,
            "dataset": dataset,
            "window_start": window_start,
            "window_end": window_end,
            "retrieved_at": retrieved_at.isoformat(),
            "records": records,
        }
        temporary = path.with_suffix(".tmp")
        try:
            temporary.write_text(
                json.dumps(payload, separators=(",", ":")),
                encoding="utf-8",
            )
            os.replace(temporary, path)
        except OSError as exc:
            logger.warning("Could not write data cache %s: %s", path, exc)
        finally:
            if temporary.exists():
                try:
                    temporary.unlink()
                except OSError:
                    pass
