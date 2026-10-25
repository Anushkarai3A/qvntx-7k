from __future__ import annotations

from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd

from app.exceptions import WindSightError

ACTUAL_COLUMNS = ["start_time", "publish_time", "generation"]
FORECAST_COLUMNS = ["start_time", "publish_time", "generation"]

HORIZON_BUCKETS: list[tuple[float, float | None, str]] = [
    (-np.inf, 0.0, "Post-delivery (<0h)"),
    (0.0, 3.0, "0-3h"),
    (3.0, 6.0, "3-6h"),
    (6.0, 12.0, "6-12h"),
    (12.0, 24.0, "12-24h"),
    (24.0, 48.0, "24-48h"),
    (48.0, np.inf, ">48h"),
]


def _utc_timestamp(value: datetime | pd.Timestamp) -> pd.Timestamp:
    timestamp = pd.Timestamp(value)
    if timestamp.tzinfo is None:
        raise WindSightError("Analysis timestamps must be timezone-aware")
    return timestamp.tz_convert("UTC")


def horizon_bucket(lead_hours: float | None) -> str:
    if lead_hours is None or not np.isfinite(lead_hours):
        return "Unknown"
    for lower, upper, label in HORIZON_BUCKETS:
        if lead_hours >= lower and (upper is None or lead_hours < upper):
            return label
    return "Unknown"


def _deduplicate_actuals(actuals: pd.DataFrame) -> pd.DataFrame:
    if actuals.empty:
        return pd.DataFrame(columns=["start_time", "actual_mw"])
    frame = actuals.copy()
    frame["start_time"] = pd.to_datetime(frame["start_time"], utc=True)
    frame["actual_mw"] = pd.to_numeric(frame["generation"], errors="coerce")
    frame = frame.dropna(subset=["start_time", "actual_mw"])
    frame = frame.sort_values(["start_time", "publish_time"], na_position="first", kind="stable")
    frame = frame.drop_duplicates(subset=["start_time"], keep="last")
    return frame[["start_time", "actual_mw"]]


def _deduplicate_forecasts(forecasts: pd.DataFrame) -> pd.DataFrame:
    if forecasts.empty:
        return pd.DataFrame(columns=["start_time", "publish_time", "forecast_mw"])
    frame = forecasts.copy()
    frame["start_time"] = pd.to_datetime(frame["start_time"], utc=True)
    frame["publish_time"] = pd.to_datetime(frame["publish_time"], utc=True)
    frame["forecast_mw"] = pd.to_numeric(frame["generation"], errors="coerce")
    frame = frame.dropna(subset=["start_time", "publish_time", "forecast_mw"])
    frame = frame.sort_values(["start_time", "publish_time"], kind="stable")
    frame = frame.drop_duplicates(subset=["start_time", "publish_time"], keep="last")
    return frame[["start_time", "publish_time", "forecast_mw"]]


def _forecast_hour(frame: pd.DataFrame) -> pd.DataFrame:
    """Return a copy keyed by the whole hour a WINDFOR value applies to.

    WINDFOR publishes one value per hour. FUELHH outturn is half-hourly, so
    each forecast value is applied to both settlement periods in its hour.
    The forecast is never interpolated or treated as sub-hourly data.
    """

    result = frame.copy()
    result["forecast_hour"] = pd.to_datetime(result["start_time"], utc=True).dt.floor("h")
    return result


def select_forecasts(
    forecasts: pd.DataFrame,
    delivery_starts: pd.DatetimeIndex,
    mode: str,
    cutoff: datetime | None = None,
    horizon_hours: float | None = None,
) -> pd.DataFrame:
    """Select one forecast version for every half-hourly delivery interval.

    WINDFOR values are hourly, so a forecast version for hour ``H`` is mapped
    to both the ``H:00`` and ``H:30`` delivery intervals. In ``latest`` mode a
    single explicit cutoff is applied. In ``horizon`` mode each delivery
    interval receives its own cutoff of delivery start - H, which preserves
    the documented per-interval decision time.
    """

    empty = pd.DataFrame(
        columns=["start_time", "forecast_valid_time", "publish_time", "forecast_mw"]
    )
    frame = _deduplicate_forecasts(forecasts)
    if frame.empty:
        return empty

    if mode == "latest":
        if cutoff is None:
            raise WindSightError("A cutoff is required for latest-forecast selection")
        cutoff_ts = _utc_timestamp(cutoff)
    elif mode == "horizon":
        if horizon_hours is None or horizon_hours <= 0:
            raise WindSightError("A positive horizon is required for horizon selection")
        cutoff_ts = None
    else:
        raise WindSightError(f"Unsupported forecast selection mode: {mode}")

    deliveries = pd.DataFrame(
        {"delivery_start": pd.DatetimeIndex(delivery_starts).tz_convert("UTC")}
    )
    if deliveries.empty:
        return empty
    deliveries["forecast_hour"] = deliveries["delivery_start"].dt.floor("h")
    deliveries = deliveries.drop_duplicates(subset=["delivery_start"])

    eligible = _forecast_hour(frame)[["forecast_hour", "publish_time", "forecast_mw"]]
    eligible = deliveries.merge(eligible, on="forecast_hour", how="inner")

    if mode == "latest":
        assert cutoff_ts is not None
        eligible = eligible[eligible["publish_time"] <= cutoff_ts]
    else:
        assert horizon_hours is not None
        eligible = eligible[
            eligible["publish_time"]
            <= eligible["delivery_start"] - pd.Timedelta(hours=float(horizon_hours))
        ]

    if eligible.empty:
        return empty

    eligible = eligible.sort_values(["delivery_start", "publish_time"], kind="stable")
    eligible = eligible.drop_duplicates(subset=["delivery_start"], keep="last")
    eligible = eligible.rename(
        columns={
            "delivery_start": "start_time",
            "forecast_hour": "forecast_valid_time",
        }
    )
    return eligible[
        ["start_time", "forecast_valid_time", "publish_time", "forecast_mw"]
    ]


def build_delivery_frame(
    actuals: pd.DataFrame,
    forecasts: pd.DataFrame,
    start: datetime,
    end: datetime,
    mode: str,
    cutoff: datetime | None = None,
    horizon_hours: float | None = None,
) -> pd.DataFrame:
    """Create the complete half-hourly evaluation frame for the delivery window."""

    start_ts = _utc_timestamp(start)
    end_ts = _utc_timestamp(end)
    if end_ts <= start_ts:
        raise WindSightError("The analysis end must be after the analysis start")

    deliveries = pd.date_range(start=start_ts, end=end_ts, freq="30min", inclusive="left")
    base = pd.DataFrame({"start_time": deliveries})

    actual_frame = _deduplicate_actuals(actuals)
    actual_frame = actual_frame[
        (actual_frame["start_time"] >= start_ts) & (actual_frame["start_time"] < end_ts)
    ]

    forecast_frame = forecasts.copy()
    if not forecast_frame.empty:
        forecast_frame["start_time"] = pd.to_datetime(forecast_frame["start_time"], utc=True)
        forecast_hours = forecast_frame["start_time"].dt.floor("h")
        forecast_frame = forecast_frame[
            (forecast_hours >= start_ts.floor("h")) & (forecast_hours < end_ts)
        ]
    selected = select_forecasts(
        forecast_frame,
        deliveries,
        mode=mode,
        cutoff=cutoff,
        horizon_hours=horizon_hours,
    )

    frame = base.merge(actual_frame, on="start_time", how="left")
    frame = frame.merge(selected, on="start_time", how="left", suffixes=("", "_forecast"))
    for column in ("forecast_valid_time", "publish_time"):
        frame[column] = pd.to_datetime(frame[column], utc=True)

    frame["delivery_date"] = frame["start_time"].dt.date
    frame["interval_label"] = frame["start_time"].dt.strftime("%H:%M")
    frame["forecast_lead_hours"] = (
        frame["start_time"] - frame["publish_time"]
    ).dt.total_seconds() / 3600.0
    frame["signed_error_mw"] = frame["forecast_mw"] - frame["actual_mw"]
    frame["abs_error_mw"] = frame["signed_error_mw"].abs()

    has_actual = frame["actual_mw"].notna()
    has_forecast = frame["forecast_mw"].notna()
    frame["eligibility_status"] = np.where(has_forecast, "eligible", "no_eligible_forecast")
    frame["data_status"] = np.select(
        [has_actual & has_forecast, has_actual & ~has_forecast, ~has_actual & has_forecast],
        ["matched", "actual_only", "forecast_only"],
        default="missing",
    )
    frame["published_before_delivery"] = np.where(
        has_forecast,
        frame["publish_time"] <= frame["start_time"],
        None,
    )
    frame["horizon_bucket"] = frame["forecast_lead_hours"].apply(horizon_bucket)

    for column in ("actual_mw", "forecast_mw", "signed_error_mw", "abs_error_mw", "forecast_lead_hours"):
        frame[column] = pd.to_numeric(frame[column], errors="coerce").astype("float64")

    return frame


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def horizon_cutoff(delivery_start: datetime, horizon_hours: float) -> datetime:
    if horizon_hours <= 0:
        raise WindSightError("Forecast horizon must be positive")
    return delivery_start - timedelta(hours=horizon_hours)
