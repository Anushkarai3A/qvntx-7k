from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query, Request

from app.schemas.responses import (
    AccuracyResponse,
    ActualsResponse,
    DataQualityResponse,
    ForecastHistoryResponse,
    ForecastsResponse,
    OverviewResponse,
    RecordsResponse,
)
from app.services.analysis_service import AnalysisService

SelectionMode = Literal["latest", "horizon"]


@dataclass
class AnalysisQuery:
    start_date: date | None
    end_date: date | None
    mode: SelectionMode
    cutoff: datetime | None
    horizon_hours: float | None


def analysis_query(
    start_date: date | None = Query(
        None, description="First delivery date (inclusive), January 2026"
    ),
    end_date: date | None = Query(
        None, description="Last delivery date (inclusive), January 2026"
    ),
    mode: SelectionMode = Query(
        "latest",
        description="latest: one explicit publication cutoff; horizon: per-interval cutoff",
    ),
    cutoff: datetime | None = Query(
        None,
        description=(
            "Explicit UTC evaluation cutoff for latest mode. Defaults to the configured "
            "DEFAULT_CUTOFF. Forecasts published after this instant are never selected."
        ),
    ),
    horizon_hours: float | None = Query(
        None,
        description=(
            "Forecast horizon in hours for horizon mode. Each delivery interval uses "
            "startTime - horizon as its eligibility cutoff."
        ),
    ),
) -> AnalysisQuery:
    return AnalysisQuery(
        start_date=start_date,
        end_date=end_date,
        mode=mode,
        cutoff=cutoff,
        horizon_hours=horizon_hours,
    )


def get_analysis_service(request: Request) -> AnalysisService:
    return request.app.state.analysis_service


router = APIRouter(tags=["WindSight analytics"])


@router.get(
    "/overview",
    summary="Overview KPIs and forecast-versus-actual series",
    response_description="Backend-computed KPIs, coverage and time series",
    response_model=OverviewResponse,
)
async def overview(
    query: AnalysisQuery = Depends(analysis_query),
    service: AnalysisService = Depends(get_analysis_service),
):
    return await service.overview(
        query.start_date,
        query.end_date,
        query.mode,
        query.cutoff,
        query.horizon_hours,
    )


@router.get(
    "/accuracy",
    summary="Accuracy metrics, grouped results and time series",
    response_model=AccuracyResponse,
)
async def accuracy(
    query: AnalysisQuery = Depends(analysis_query),
    service: AnalysisService = Depends(get_analysis_service),
):
    return await service.accuracy(
        query.start_date,
        query.end_date,
        query.mode,
        query.cutoff,
        query.horizon_hours,
    )


@router.get(
    "/actuals",
    summary="FUELHH WIND actual generation for the delivery window",
    response_model=ActualsResponse,
)
async def actuals(
    query: AnalysisQuery = Depends(analysis_query),
    service: AnalysisService = Depends(get_analysis_service),
):
    return await service.actuals(
        query.start_date,
        query.end_date,
        query.mode,
        query.cutoff,
        query.horizon_hours,
    )


@router.get(
    "/forecasts",
    summary="Selected wind forecasts for the delivery window",
    response_model=ForecastsResponse,
)
async def forecasts(
    query: AnalysisQuery = Depends(analysis_query),
    service: AnalysisService = Depends(get_analysis_service),
):
    return await service.forecasts(
        query.start_date,
        query.end_date,
        query.mode,
        query.cutoff,
        query.horizon_hours,
    )


@router.get(
    "/records",
    summary="Evaluation records for the data explorer",
    description=(
        "One row per half-hourly delivery interval. Missing actuals and forecasts are "
        "preserved as null rather than zero."
    ),
    response_model=RecordsResponse,
)
async def records(
    query: AnalysisQuery = Depends(analysis_query),
    service: AnalysisService = Depends(get_analysis_service),
):
    return await service.records(
        query.start_date,
        query.end_date,
        query.mode,
        query.cutoff,
        query.horizon_hours,
    )


@router.get(
    "/forecast-history",
    summary="Forecast versions published for one delivery interval",
    description=(
        "Returns every retained WINDFOR version for the interval, each version's "
        "eligibility at the selected decision cutoff, and the version selected by the "
        "current mode."
    ),
    response_model=ForecastHistoryResponse,
)
async def forecast_history(
    delivery_start: datetime | None = Query(
        None,
        description="Half-hourly delivery interval start in UTC; defaults to the latest eligible interval",
    ),
    query: AnalysisQuery = Depends(analysis_query),
    service: AnalysisService = Depends(get_analysis_service),
):
    return await service.forecast_history(
        delivery_start,
        query.mode,
        query.cutoff,
        query.horizon_hours,
    )


@router.get(
    "/data-quality",
    summary="Data coverage and ingestion diagnostics",
    response_model=DataQualityResponse,
)
async def data_quality(
    query: AnalysisQuery = Depends(analysis_query),
    service: AnalysisService = Depends(get_analysis_service),
):
    return await service.data_quality(
        query.start_date,
        query.end_date,
        query.mode,
        query.cutoff,
        query.horizon_hours,
    )
