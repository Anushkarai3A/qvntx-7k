from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

import httpx

from app.config import Settings
from app.exceptions import UpstreamDataError

logger = logging.getLogger(__name__)

FUELHH_ENDPOINT = "/datasets/FUELHH"
WINDFOR_ENDPOINT = "/datasets/WINDFOR"

TRANSIENT_STATUS_CODES = {429, 500, 502, 503, 504}


@dataclass
class FetchResult:
    records: list[dict]
    requests_made: int


def _iso_z(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


class ElexonClient:
    """Small async client for the documented Elexon BMRS dataset endpoints.

    Elexon limits both FUELHH settlement-date requests and WINDFOR
    publication-date requests to a maximum seven-day inclusive window, so
    larger historical ranges are split into non-overlapping windows.
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self.base_url = settings.elexon_base_url.rstrip("/")

    @property
    def headers(self) -> dict[str, str]:
        return {"Accept": "application/json", "User-Agent": "WindSight-UK/1.0"}

    async def fetch_actuals(self, start_date: date, end_date: date) -> FetchResult:
        if end_date < start_date:
            raise UpstreamDataError("Actuals end date precedes start date")

        records: list[dict] = []
        requests = 0
        cursor = start_date
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(self.settings.request_timeout_seconds),
            headers=self.headers,
            follow_redirects=True,
        ) as client:
            while cursor <= end_date:
                chunk_end = min(cursor + timedelta(days=6), end_date)
                params = {
                    "format": "json",
                    "fuelType": "WIND",
                    "settlementDateFrom": cursor.isoformat(),
                    "settlementDateTo": chunk_end.isoformat(),
                }
                payload = await self._request_with_retry(client, FUELHH_ENDPOINT, params)
                records.extend(self._extract_data(payload, FUELHH_ENDPOINT))
                requests += 1
                cursor = chunk_end + timedelta(days=1)

        logger.info("Fetched %s FUELHH WIND rows in %s requests", len(records), requests)
        return FetchResult(records=records, requests_made=requests)

    async def fetch_forecasts(self, start: datetime, end: datetime) -> FetchResult:
        if end <= start:
            raise UpstreamDataError("Forecast history end must be after start")

        records: list[dict] = []
        requests = 0
        cursor = start
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(self.settings.request_timeout_seconds),
            headers=self.headers,
            follow_redirects=True,
        ) as client:
            while cursor < end:
                chunk_end = min(cursor + timedelta(days=7), end) - timedelta(microseconds=1)
                params = {
                    "format": "json",
                    "publishDateTimeFrom": _iso_z(cursor),
                    "publishDateTimeTo": _iso_z(chunk_end),
                }
                payload = await self._request_with_retry(client, WINDFOR_ENDPOINT, params)
                records.extend(self._extract_data(payload, WINDFOR_ENDPOINT))
                requests += 1
                cursor = chunk_end + timedelta(microseconds=1)

        logger.info("Fetched %s WINDFOR rows in %s requests", len(records), requests)
        return FetchResult(records=records, requests_made=requests)

    async def _request_with_retry(
        self,
        client: httpx.AsyncClient,
        endpoint: str,
        params: dict,
    ) -> dict:
        url = f"{self.base_url}{endpoint}"
        attempts = self.settings.max_retries + 1
        last_error: Exception | None = None

        for attempt in range(attempts):
            try:
                response = await client.get(url, params=params)
                if response.status_code in TRANSIENT_STATUS_CODES:
                    retry_after = response.headers.get("Retry-After")
                    raise _RetryableStatus(response.status_code, retry_after)
                response.raise_for_status()
                try:
                    payload = response.json()
                except ValueError as exc:
                    raise UpstreamDataError(
                        f"Elexon returned non-JSON content for {endpoint}"
                    ) from exc
                if not isinstance(payload, dict):
                    raise UpstreamDataError(
                        f"Unexpected Elexon response shape for {endpoint}"
                    )
                return payload
            except _RetryableStatus as exc:
                last_error = exc
                if attempt >= attempts - 1:
                    break
                delay = self._retry_delay(attempt, exc.retry_after)
                logger.warning(
                    "Elexon %s returned %s; retrying in %.1fs (%s/%s)",
                    endpoint,
                    exc.status_code,
                    delay,
                    attempt + 1,
                    self.settings.max_retries,
                )
                await asyncio.sleep(delay)
            except httpx.HTTPStatusError as exc:
                detail = self._error_detail(exc.response)
                raise UpstreamDataError(
                    f"Elexon {endpoint} returned HTTP {exc.response.status_code}: {detail}"
                ) from exc
            except httpx.RequestError as exc:
                last_error = exc
                if attempt >= attempts - 1:
                    break
                delay = self._retry_delay(attempt, None)
                logger.warning(
                    "Elexon %s request failed (%s); retrying in %.1fs",
                    endpoint,
                    exc.__class__.__name__,
                    delay,
                )
                await asyncio.sleep(delay)
            except UpstreamDataError:
                raise

        message = f"Elexon {endpoint} could not be reached after {attempts} attempts"
        if last_error:
            message = f"{message}: {last_error}"
        raise UpstreamDataError(message)

    def _retry_delay(self, attempt: int, retry_after: str | None) -> float:
        if retry_after:
            try:
                return max(0.0, min(float(retry_after), 30.0))
            except ValueError:
                pass
        return self.settings.retry_backoff_seconds * (2**attempt)

    @staticmethod
    def _error_detail(response: httpx.Response) -> str:
        try:
            payload = response.json()
            if isinstance(payload, dict):
                if payload.get("detail"):
                    return str(payload["detail"])
                if payload.get("title"):
                    return str(payload["title"])
        except ValueError:
            pass
        text = response.text.strip()
        return text[:300] if text else "no error detail returned"

    @staticmethod
    def _extract_data(payload: dict, endpoint: str) -> list[dict]:
        data = payload.get("data")
        if not isinstance(data, list):
            raise UpstreamDataError(
                f"Elexon {endpoint} response did not contain a data array"
            )
        return [row for row in data if isinstance(row, dict)]


class _RetryableStatus(Exception):
    def __init__(self, status_code: int, retry_after: str | None):
        self.status_code = status_code
        self.retry_after = retry_after
        super().__init__(f"Retryable HTTP status {status_code}")
