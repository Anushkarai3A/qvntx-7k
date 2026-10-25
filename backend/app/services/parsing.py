from __future__ import annotations

from dataclasses import dataclass

import pandas as pd
from pydantic import ValidationError

from app.schemas.raw import ElexonActualRecord, ElexonForecastRecord


@dataclass
class ParsedDataset:
    frame: pd.DataFrame
    invalid_records: int
    missing_generation: int
    wrong_fuel_type: int
    duplicates_removed: int


def _empty_frame(columns: list[str]) -> pd.DataFrame:
    return pd.DataFrame(columns=columns)


def parse_actuals(records: list[dict]) -> ParsedDataset:
    rows: list[dict] = []
    invalid = 0
    missing_generation = 0
    wrong_fuel = 0

    for record in records:
        try:
            parsed = ElexonActualRecord.model_validate(record)
        except ValidationError:
            invalid += 1
            continue
        if parsed.fuelType and parsed.fuelType != "WIND":
            wrong_fuel += 1
            continue
        if parsed.generation is None:
            missing_generation += 1
            continue
        rows.append(parsed.to_normalized())

    columns = [
        "start_time",
        "publish_time",
        "settlement_date",
        "settlement_period",
        "fuel_type",
        "generation",
    ]
    if not rows:
        return ParsedDataset(
            frame=_empty_frame(columns),
            invalid_records=invalid,
            missing_generation=missing_generation,
            wrong_fuel_type=wrong_fuel,
            duplicates_removed=0,
        )

    frame = pd.DataFrame(rows)
    frame["start_time"] = pd.to_datetime(frame["start_time"], utc=True)
    frame["publish_time"] = pd.to_datetime(frame["publish_time"], utc=True, errors="coerce")
    frame["generation"] = pd.to_numeric(frame["generation"], errors="coerce")
    frame = frame.dropna(subset=["start_time", "generation"])

    before = len(frame)
    frame = frame.sort_values(["start_time", "publish_time"], na_position="first", kind="stable")
    frame = frame.drop_duplicates(subset=["start_time"], keep="last").reset_index(drop=True)
    duplicates = before - len(frame)

    return ParsedDataset(
        frame=frame,
        invalid_records=invalid,
        missing_generation=missing_generation,
        wrong_fuel_type=wrong_fuel,
        duplicates_removed=duplicates,
    )


def parse_forecasts(records: list[dict]) -> ParsedDataset:
    rows: list[dict] = []
    invalid = 0
    missing_generation = 0

    for record in records:
        try:
            parsed = ElexonForecastRecord.model_validate(record)
        except ValidationError:
            invalid += 1
            continue
        if parsed.generation is None:
            missing_generation += 1
            continue
        rows.append(parsed.to_normalized())

    columns = ["start_time", "publish_time", "generation"]
    if not rows:
        return ParsedDataset(
            frame=_empty_frame(columns),
            invalid_records=invalid,
            missing_generation=missing_generation,
            wrong_fuel_type=0,
            duplicates_removed=0,
        )

    frame = pd.DataFrame(rows)
    frame["start_time"] = pd.to_datetime(frame["start_time"], utc=True)
    frame["publish_time"] = pd.to_datetime(frame["publish_time"], utc=True)
    frame["generation"] = pd.to_numeric(frame["generation"], errors="coerce")
    frame = frame.dropna(subset=["start_time", "publish_time", "generation"])

    before = len(frame)
    frame = frame.sort_values(["start_time", "publish_time"], kind="stable")
    frame = frame.drop_duplicates(
        subset=["start_time", "publish_time"], keep="last"
    ).reset_index(drop=True)
    duplicates = before - len(frame)

    return ParsedDataset(
        frame=frame,
        invalid_records=invalid,
        missing_generation=missing_generation,
        wrong_fuel_type=0,
        duplicates_removed=duplicates,
    )
