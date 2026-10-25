from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.config import Settings, get_settings
from app.exceptions import (
    DataUnavailableError,
    IncompleteDataError,
    InvalidRequestError,
    UpstreamDataError,
    WindSightError,
)
from app.schemas.responses import HealthResponse
from app.services.analysis_service import AnalysisService
from app.services.data_service import DataService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    app_settings = settings or get_settings()
    app = FastAPI(
        title=app_settings.app_name,
        version="1.0.0",
        description=(
            "WindSight UK analytics API. Uses only national wind generation actuals "
            "from Elexon FUELHH and wind forecasts from Elexon WINDFOR. All timestamps "
            "are handled in UTC. Accuracy calculations are performed in the backend."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=app_settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "OPTIONS"],
        allow_headers=["*"],
    )

    data_service = DataService(app_settings)
    app.state.settings = app_settings
    app.state.data_service = data_service
    app.state.analysis_service = AnalysisService(app_settings, data_service)

    app.include_router(router, prefix=app_settings.api_prefix)

    @app.get("/health", response_model=HealthResponse, tags=["Operations"])
    async def health() -> HealthResponse:
        return HealthResponse(
            status="ok",
            service=app_settings.app_name,
            environment=app_settings.environment,
            data_loaded=data_service.data_loaded,
        )

    @app.get("/", tags=["Operations"])
    async def root() -> dict[str, str]:
        return {
            "service": app_settings.app_name,
            "docs": "/docs",
            "health": "/health",
            "api": app_settings.api_prefix,
        }

    @app.exception_handler(RequestValidationError)
    async def request_validation_handler(request: Request, exc: RequestValidationError):
        messages: list[str] = []
        for error in exc.errors():
            location = ".".join(
                str(part)
                for part in error.get("loc", ())
                if part not in ("query", "path", "body")
            )
            message = str(error.get("msg", "Invalid value"))
            messages.append(f"{location}: {message}" if location else message)
        return JSONResponse(
            status_code=400,
            content={
                "detail": "; ".join(messages) or "Invalid request parameters",
                "error": "invalid_request",
            },
        )

    @app.exception_handler(InvalidRequestError)
    async def invalid_request_handler(request: Request, exc: InvalidRequestError):
        return JSONResponse(
            status_code=400,
            content={"detail": str(exc), "error": "invalid_request"},
        )

    @app.exception_handler(DataUnavailableError)
    async def data_unavailable_handler(request: Request, exc: DataUnavailableError):
        logger.error("Data unavailable: %s", exc)
        return JSONResponse(
            status_code=503,
            content={
                "detail": str(exc),
                "error": "data_unavailable",
                "hint": "Check connectivity to data.elexon.co.uk or retry later.",
            },
        )

    @app.exception_handler(IncompleteDataError)
    async def incomplete_data_handler(request: Request, exc: IncompleteDataError):
        logger.error("Incomplete data: %s", exc)
        return JSONResponse(
            status_code=503,
            content={"detail": str(exc), "error": "incomplete_upstream_data"},
        )

    @app.exception_handler(UpstreamDataError)
    async def upstream_error_handler(request: Request, exc: UpstreamDataError):
        logger.error("Upstream error: %s", exc)
        return JSONResponse(
            status_code=502,
            content={"detail": str(exc), "error": "upstream_error"},
        )

    @app.exception_handler(WindSightError)
    async def generic_windsight_handler(request: Request, exc: WindSightError):
        logger.exception("WindSight error", exc_info=exc)
        return JSONResponse(
            status_code=500,
            content={"detail": str(exc), "error": "internal_analysis_error"},
        )

    return app


app = create_app()
