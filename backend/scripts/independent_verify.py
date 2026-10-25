#!/usr/bin/env python3
"""Independent real-data verification for WindSight UK.

This script deliberately imports only the Python standard library and reads the raw
Elexon cache directly. It does not import any application analytics code, so it provides
an independent reference for forecast selection and KPI calculations.

Examples:
    python backend/scripts/independent_verify.py
    python backend/scripts/independent_verify.py --base-url http://localhost:8080
    python backend/scripts/independent_verify.py --csv-out verification/metrics.csv
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

HORIZONS = (3.0, 6.0, 12.0, 24.0, 36.0, 48.0, 60.0, 72.0)
LATEST_CUTOFFS = (
    datetime(2026, 2, 1, tzinfo=timezone.utc),
    datetime(2026, 1, 15, tzinfo=timezone.utc),
    datetime(2026, 1, 10, 12, 30, tzinfo=timezone.utc),
)
TOLERANCE = 0.00051


def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def floor_hour(value: datetime) -> datetime:
    return value.replace(minute=0, second=0, microsecond=0)


def iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def load_cache(path: Path) -> list[dict[str, Any]]:
    return json.loads(path.read_text(encoding="utf-8"))["records"]


def build_reference(
    actual_records: list[dict[str, Any]],
    forecast_records: list[dict[str, Any]],
) -> tuple[
    dict[datetime, tuple[datetime, float]],
    dict[datetime, dict[tuple[datetime, datetime], float]],
]:
    actuals: dict[datetime, tuple[datetime, float]] = {}
    for record in actual_records:
        if record.get("generation") is None:
            continue
        start = parse_time(record["startTime"])
        published = parse_time(record["publishTime"])
        current = actuals.get(start)
        if current is None or published > current[0]:
            actuals[start] = (published, float(record["generation"]))

    forecasts: dict[datetime, dict[tuple[datetime, datetime], float]] = defaultdict(dict)
    for record in forecast_records:
        if record.get("generation") is None:
            continue
        start = parse_time(record["startTime"])
        published = parse_time(record["publishTime"])
        forecasts[floor_hour(start)][(start, published)] = float(record["generation"])
    return actuals, forecasts


def build_deliveries() -> list[datetime]:
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    end = datetime(2026, 2, 1, tzinfo=timezone.utc)
    deliveries: list[datetime] = []
    while start < end:
        deliveries.append(start)
        start += timedelta(minutes=30)
    return deliveries


def select_version(
    forecasts: dict[datetime, dict[tuple[datetime, datetime], float]],
    delivery: datetime,
    mode: str,
    horizon: float | None = None,
    cutoff: datetime | None = None,
) -> tuple[datetime, float] | None:
    decision_cutoff = delivery - timedelta(hours=horizon) if mode == "horizon" else cutoff
    if decision_cutoff is None:
        raise ValueError("cutoff or horizon is required")
    eligible = [
        (published, generation)
        for (_, published), generation in forecasts.get(floor_hour(delivery), {}).items()
        if published <= decision_cutoff
    ]
    if not eligible:
        return None
    latest = max(published for published, _ in eligible)
    generation = [value for published, value in eligible if published == latest][-1]
    return latest, generation


def reference_metrics(
    actuals: dict[datetime, tuple[datetime, float]],
    forecasts: dict[datetime, dict[tuple[datetime, datetime], float]],
    deliveries: list[datetime],
    mode: str,
    horizon: float | None = None,
    cutoff: datetime | None = None,
) -> dict[str, float | int | None]:
    rows: list[tuple[float, float, float]] = []
    for delivery in deliveries:
        actual = actuals.get(delivery)
        selected = select_version(forecasts, delivery, mode, horizon, cutoff)
        if actual is None or selected is None:
            continue
        error = selected[1] - actual[1]
        rows.append((actual[1], selected[1], error))

    if not rows:
        return {
            "matched": 0,
            "mae": None,
            "rmse": None,
            "wape": None,
            "mean": None,
            "max_abs": None,
        }

    errors = [error for _, _, error in rows]
    absolute_errors = [abs(error) for error in errors]
    actual_total = sum(abs(actual) for actual, _, _ in rows)
    return {
        "matched": len(rows),
        "mae": sum(absolute_errors) / len(rows),
        "rmse": math.sqrt(sum(error * error for error in errors) / len(rows)),
        "wape": (sum(absolute_errors) / actual_total * 100) if actual_total else None,
        "mean": sum(errors) / len(rows),
        "max_abs": max(absolute_errors),
    }


def write_matched_records(
    actuals: dict[datetime, tuple[datetime, float]],
    forecasts: dict[datetime, dict[tuple[datetime, datetime], float]],
    deliveries: list[datetime],
    path: Path,
    horizon: float = 24.0,
) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "delivery_start",
                "actual_mw",
                "forecast_mw",
                "forecast_valid_time",
                "forecast_publish_time",
                "forecast_lead_hours",
                "signed_error_mw",
                "abs_error_mw",
            ]
        )
        for delivery in deliveries:
            actual = actuals.get(delivery)
            selected = select_version(forecasts, delivery, "horizon", horizon=horizon)
            if actual is None or selected is None:
                continue
            error = selected[1] - actual[1]
            writer.writerow(
                [
                    iso(delivery),
                    actual[1],
                    selected[1],
                    iso(floor_hour(delivery)),
                    iso(selected[0]),
                    round((delivery - selected[0]).total_seconds() / 3600, 3),
                    error,
                    abs(error),
                ]
            )
            count += 1
    return count


def fetch_json(base_url: str, path: str, params: dict[str, Any]) -> dict[str, Any]:
    query = urllib.parse.urlencode(params)
    url = f"{base_url.rstrip('/')}{path}?{query}"
    with urllib.request.urlopen(url, timeout=120) as response:
        return json.load(response)


def diff(reference: float | None, actual: float | None) -> float | None:
    if reference is None or actual is None:
        return None
    return round(reference - actual, 9)


def verify(
    actuals: dict[datetime, tuple[datetime, float]],
    forecasts: dict[datetime, dict[tuple[datetime, datetime], float]],
    deliveries: list[datetime],
    base_url: str,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for horizon in HORIZONS:
        reference = reference_metrics(actuals, forecasts, deliveries, "horizon", horizon)
        accuracy = fetch_json(
            base_url,
            "/api/accuracy",
            {"mode": "horizon", "horizon_hours": horizon},
        )
        metrics = accuracy["metrics"]
        coverage = accuracy["coverage"]
        records = fetch_json(
            base_url,
            "/api/records",
            {"mode": "horizon", "horizon_hours": horizon},
        )["records"]
        by_delivery = {parse_time(record["delivery_start"]): record for record in records}

        selection_mismatches = 0
        value_mismatches = 0
        selected_post_cutoff = 0
        post_cutoff_versions = 0
        exact_versions = 0
        exact_selected = 0
        different_version_pairs = 0

        for delivery in deliveries:
            cutoff = delivery - timedelta(hours=horizon)
            versions = forecasts.get(floor_hour(delivery), {})
            post_cutoff_versions += sum(1 for (_, published) in versions if published > cutoff)
            exact = [(published, value) for (_, published), value in versions.items() if published == cutoff]
            exact_versions += len(exact)
            reference_selection = select_version(
                forecasts, delivery, "horizon", horizon=horizon
            )
            row = by_delivery[delivery]
            if reference_selection is None:
                if row["forecast_publish_time"] is not None:
                    selection_mismatches += 1
            else:
                published = parse_time(row["forecast_publish_time"])
                if published != reference_selection[0]:
                    selection_mismatches += 1
                if published > cutoff:
                    selected_post_cutoff += 1
                if row["forecast_mw"] != reference_selection[1]:
                    value_mismatches += 1
                if exact and published == cutoff:
                    exact_selected += len(exact)

        for delivery in deliveries[::2]:
            first = by_delivery[delivery]
            second = by_delivery[delivery + timedelta(minutes=30)]
            if first["forecast_publish_time"] != second["forecast_publish_time"]:
                different_version_pairs += 1

        expected_coverage = round(reference["matched"] / len(deliveries) * 100, 2)
        failures = []
        if reference["matched"] != metrics["matched_observations"]:
            failures.append("matched count")
        if reference["matched"] != coverage["matched_observations"]:
            failures.append("coverage matched count")
        if abs((expected_coverage or 0.0) - coverage["data_coverage_pct"]) > 0.011:
            failures.append("coverage percentage")
        for key, api_key in (
            ("mae", "mae_mw"),
            ("rmse", "rmse_mw"),
            ("wape", "wape_pct"),
            ("mean", "mean_error_mw"),
            ("max_abs", "max_abs_error_mw"),
        ):
            if diff(reference[key], metrics[api_key]) is None:
                if reference[key] is not None or metrics[api_key] is not None:
                    failures.append(key)
            elif abs(diff(reference[key], metrics[api_key]) or 0.0) > TOLERANCE:
                failures.append(key)
        if selection_mismatches:
            failures.append("selection")
        if value_mismatches:
            failures.append("forecast value")
        if selected_post_cutoff:
            failures.append("post-cutoff selection")
        if exact_selected != exact_versions:
            failures.append("exact-cutoff inclusion")

        rows.append(
            {
                "view": f"horizon {horizon:g}h",
                "matched": reference["matched"],
                "api_matched": metrics["matched_observations"],
                "coverage_pct": coverage["data_coverage_pct"],
                "mae": reference["mae"],
                "api_mae": metrics["mae_mw"],
                "mae_delta": diff(reference["mae"], metrics["mae_mw"]),
                "rmse": reference["rmse"],
                "api_rmse": metrics["rmse_mw"],
                "rmse_delta": diff(reference["rmse"], metrics["rmse_mw"]),
                "wape": reference["wape"],
                "api_wape": metrics["wape_pct"],
                "wape_delta": diff(reference["wape"], metrics["wape_pct"]),
                "mean": reference["mean"],
                "api_mean": metrics["mean_error_mw"],
                "mean_delta": diff(reference["mean"], metrics["mean_error_mw"]),
                "max_abs": reference["max_abs"],
                "api_max_abs": metrics["max_abs_error_mw"],
                "max_abs_delta": diff(reference["max_abs"], metrics["max_abs_error_mw"]),
                "selection_mismatches": selection_mismatches,
                "value_mismatches": value_mismatches,
                "post_cutoff_versions": post_cutoff_versions,
                "selected_post_cutoff": selected_post_cutoff,
                "exact_versions": exact_versions,
                "exact_selected": exact_selected,
                "different_version_pairs": different_version_pairs,
                "selected_after_delivery": 0,
                "failures": "; ".join(failures),
            }
        )

    for cutoff in LATEST_CUTOFFS:
        reference = reference_metrics(actuals, forecasts, deliveries, "latest", cutoff=cutoff)
        accuracy = fetch_json(
            base_url,
            "/api/accuracy",
            {"mode": "latest", "cutoff": iso(cutoff)},
        )
        metrics = accuracy["metrics"]
        records = fetch_json(
            base_url,
            "/api/records",
            {"mode": "latest", "cutoff": iso(cutoff)},
        )["records"]
        by_delivery = {parse_time(record["delivery_start"]): record for record in records}

        selection_mismatches = 0
        value_mismatches = 0
        selected_after_delivery = 0
        for delivery in deliveries:
            reference_selection = select_version(forecasts, delivery, "latest", cutoff=cutoff)
            row = by_delivery[delivery]
            if reference_selection is None:
                if row["forecast_publish_time"] is not None:
                    selection_mismatches += 1
            else:
                published = parse_time(row["forecast_publish_time"])
                if published != reference_selection[0]:
                    selection_mismatches += 1
                if row["forecast_mw"] != reference_selection[1]:
                    value_mismatches += 1
                if published > delivery:
                    selected_after_delivery += 1

        failures = []
        if reference["matched"] != metrics["matched_observations"]:
            failures.append("matched count")
        for key, api_key in (
            ("mae", "mae_mw"),
            ("rmse", "rmse_mw"),
            ("wape", "wape_pct"),
            ("mean", "mean_error_mw"),
            ("max_abs", "max_abs_error_mw"),
        ):
            if diff(reference[key], metrics[api_key]) is None:
                if reference[key] is not None or metrics[api_key] is not None:
                    failures.append(key)
            elif abs(diff(reference[key], metrics[api_key]) or 0.0) > TOLERANCE:
                failures.append(key)
        if selection_mismatches:
            failures.append("selection")
        if value_mismatches:
            failures.append("forecast value")
        if selected_after_delivery and not any(
            "published after their delivery" in warning
            for warning in accuracy["meta"]["data_status"]["warnings"]
        ):
            failures.append("post-delivery warning")

        rows.append(
            {
                "view": f"latest {iso(cutoff)}",
                "matched": reference["matched"],
                "api_matched": metrics["matched_observations"],
                "coverage_pct": accuracy["coverage"]["data_coverage_pct"],
                "mae": reference["mae"],
                "api_mae": metrics["mae_mw"],
                "mae_delta": diff(reference["mae"], metrics["mae_mw"]),
                "rmse": reference["rmse"],
                "api_rmse": metrics["rmse_mw"],
                "rmse_delta": diff(reference["rmse"], metrics["rmse_mw"]),
                "wape": reference["wape"],
                "api_wape": metrics["wape_pct"],
                "wape_delta": diff(reference["wape"], metrics["wape_pct"]),
                "mean": reference["mean"],
                "api_mean": metrics["mean_error_mw"],
                "mean_delta": diff(reference["mean"], metrics["mean_error_mw"]),
                "max_abs": reference["max_abs"],
                "api_max_abs": metrics["max_abs_error_mw"],
                "max_abs_delta": diff(reference["max_abs"], metrics["max_abs_error_mw"]),
                "selection_mismatches": selection_mismatches,
                "value_mismatches": value_mismatches,
                "post_cutoff_versions": 0,
                "selected_post_cutoff": 0,
                "exact_versions": 0,
                "exact_selected": 0,
                "different_version_pairs": 0,
                "selected_after_delivery": selected_after_delivery,
                "failures": "; ".join(failures),
            }
        )
    return rows


def main() -> int:
    backend_dir = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://localhost:8080")
    parser.add_argument(
        "--actuals-cache",
        type=Path,
        default=backend_dir / "data/cache/fuelhh_wind_2026-01-01_2026-01-31_v1.json",
    )
    parser.add_argument(
        "--forecasts-cache",
        type=Path,
        default=backend_dir / "data/cache/windfor_2025-12-28_2026-02-01_v1.json",
    )
    parser.add_argument("--csv-out", type=Path)
    parser.add_argument(
        "--records-out",
        type=Path,
        help="Write the independently selected 24h matched records to this CSV path",
    )
    args = parser.parse_args()

    actual_records = load_cache(args.actuals_cache)
    forecast_records = load_cache(args.forecasts_cache)
    actuals, forecasts = build_reference(actual_records, forecast_records)
    deliveries = build_deliveries()

    print(
        "raw counts:",
        f"actuals={len(actual_records)}",
        f"unique_actuals={len(actuals)}",
        f"forecast_records={len(forecast_records)}",
        f"forecast_hours={len(forecasts)}",
        f"publications={len({p for versions in forecasts.values() for _, p in versions})}",
        f"deliveries={len(deliveries)}",
    )

    if args.records_out:
        count = write_matched_records(actuals, forecasts, deliveries, args.records_out)
        print(f"wrote {count} independently selected 24h matched records to {args.records_out}")

    rows = verify(actuals, forecasts, deliveries, args.base_url)

    columns = [
        "view",
        "matched",
        "api_matched",
        "coverage_pct",
        "mae",
        "api_mae",
        "mae_delta",
        "rmse",
        "api_rmse",
        "rmse_delta",
        "wape",
        "api_wape",
        "wape_delta",
        "mean",
        "api_mean",
        "mean_delta",
        "max_abs",
        "api_max_abs",
        "max_abs_delta",
        "selection_mismatches",
        "value_mismatches",
        "post_cutoff_versions",
        "selected_post_cutoff",
        "exact_versions",
        "exact_selected",
        "different_version_pairs",
        "selected_after_delivery",
        "failures",
    ]
    for row in rows:
        print(
            f"{row['view']:<27} matched={row['matched']:>4}/{row['api_matched']:<4} "
            f"coverage={row['coverage_pct']:>6.2f}% "
            f"MAE delta={str(row['mae_delta']):>11} RMSE delta={str(row['rmse_delta']):>11} "
            f"WAPE delta={str(row['wape_delta']):>11} "
            f"selection_mismatch={row['selection_mismatches']} "
            f"post_cutoff_selected={row['selected_post_cutoff']} "
            f"exact={row['exact_selected']}/{row['exact_versions']} "
            f"pair_versions_diff={row['different_version_pairs']} "
            f"failures={row['failures'] or 'none'}"
        )

    if args.csv_out:
        args.csv_out.parent.mkdir(parents=True, exist_ok=True)
        with args.csv_out.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=columns)
            writer.writeheader()
            writer.writerows(rows)
        print(f"wrote {args.csv_out}")

    failed = [row for row in rows if row["failures"]]
    print(f"RESULT: {'FAIL' if failed else 'PASS'} ({len(rows) - len(failed)}/{len(rows)} views)")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
