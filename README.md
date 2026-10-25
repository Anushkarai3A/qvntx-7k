# WindSight UK

WindSight UK is a full-stack dashboard for monitoring national wind generation forecast
accuracy across the January 2026 GB electricity delivery period. It compares Elexon
`FUELHH` WIND actual generation with `WINDFOR` wind forecasts, applies explicit
no-look-ahead selection rules, and computes every KPI in the Python backend.

![WindSight UK stack](https://img.shields.io/badge/stack-FastAPI%20%2B%20React-0f766e)
![Data](https://img.shields.io/badge/data-Elexon%20BMRS-0b3b60)
![Tests](https://img.shields.io/badge/tests-39%20backend%20%2F%209%20frontend%20%2F%206%20E2E-15803d)

## Contents

- [What it does](#what-it-does)
- [Data source and assumptions](#data-source-and-assumptions)
- [Architecture](#architecture)
- [Local development](#local-development)
- [Docker](#docker)
- [Configuration](#configuration)
- [API](#api)
- [Deployment](#deployment)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Limitations](#limitations)

## What it does

- Shows forecast-versus-actual wind generation for every half-hourly delivery interval
  in January 2026.
- Supports two forecast-selection rules:
  - **Forecast horizon**: each delivery interval uses its own cutoff of
    `delivery start - horizon`, selecting the latest forecast published on or before
    that cutoff.
  - **Latest available**: one explicit global cutoff is applied to every delivery
    interval, selecting the latest forecast published on or before that cutoff.
- Computes KPIs from matched observations only: mean signed error, MAE, RMSE, WAPE,
  maximum absolute error, and coverage.
- Breaks accuracy down by delivery date, time of day, and forecast lead-time bucket.
- Explores individual delivery intervals and every retained forecast version for an
  interval, including whether each version was eligible at the decision cutoff.
- Exports the currently filtered explorer rows to CSV.
- Surfaces data freshness, coverage, source warnings, and partial-data states instead
  of hiding missing values.

## Data source and assumptions

### Upstream endpoints

| Dataset | Elexon endpoint | Used for |
| --- | --- | --- |
| FUELHH | `/datasets/FUELHH/stream` | National wind generation actuals |
| WINDFOR | `/datasets/WINDFOR/stream` | National wind generation forecast versions |

Base URL: `https://data.elexon.co.uk/bmrs/api/v1`

The upstream APIs limit a single query window to seven days, so the backend splits
requests into seven-day chunks. Requests use timeouts, bounded retries, exponential
backoff, and schema validation.

### Evaluation window

- Delivery window: `2026-01-01T00:00:00Z` to `2026-02-01T00:00:00Z` (exclusive end).
- Forecast publication history starts at `2025-12-28T00:00:00Z` so forecasts published
  before January are available for early delivery intervals.
- All internal calculations and API timestamps are UTC.
- Missing values are preserved as `null` and are **never** treated as zero.

### Matching and selection

- FUELHH actuals are half-hourly. WINDFOR forecasts are hourly. Elexon documents
  WINDFOR as a national hourly forecast published up to eight times a day; API values
  carry whole-hour `startTime` values.
- Each hourly WINDFOR value is applied to both half-hourly settlement periods whose
  start falls in that forecast hour. The source hour is exposed as
  `forecast_valid_time`. This is an explicit alignment policy: it preserves
  half-hourly coverage without interpolation or implied sub-hourly forecast detail.
- Forecast versions are deduplicated on `(startTime, publishTime)`. A forecast version
  for hour `H` is independently selected for the `H:00` and `H:30` delivery intervals,
  so each interval respects its own decision cutoff.
- Actuals are deduplicated on `startTime`, retaining the latest publication.
- Selection is always constrained by `publishTime <= eligible cutoff`. In horizon
  mode the cutoff varies by delivery interval, so no later publication can leak into
  an earlier decision.
- The default latest-mode cutoff is `2026-02-01T00:00:00Z`. This is a retrospective
  "latest available" view and can include forecasts published after delivery. The API
  returns warnings and the UI displays them. The default UI mode is instead a 24-hour
  forecast horizon.

Coverage in the retained dataset declines with horizon length because forecast history
starts on 2025-12-28 and the longest retained lead is 66.5 hours:

| Horizon | Matched coverage |
| --- | --- |
| 3-36 h | 100% |
| 48 h | 81% |
| 60 h | 31% |
| 72 h | 0% |

A 72-hour horizon is a valid request and returns HTTP 200 with null metrics, zero
coverage, and an explanatory warning; it is not an error.

### Metric definitions

| Metric | Definition |
| --- | --- |
| Mean error | Mean of `forecast - actual` (positive means over-forecast) |
| MAE | Mean absolute error |
| RMSE | Root mean squared error |
| WAPE | `sum(abs(error)) / sum(abs(actual)) * 100` |
| Max absolute error | Largest absolute error among matched observations |
| Matched coverage | Matched observations / expected half-hourly intervals |

MAPE is deliberately not used because actual wind generation can be close to zero.

### Caching and resilience

- Processed upstream responses are cached under `backend/data/cache/` by default.
- Cache lifetime is controlled by `CACHE_TTL_SECONDS` (default 24 hours). Freshness is
  checked when a dataset is loaded from disk.
- Processed data is held in memory after the first analytics request. The TTL does not
  evict or refresh an already-loaded in-memory dataset; restart the process to pick up
  newly published upstream data after expiry. No public refresh endpoint is exposed.
  This is acceptable for the fixed January 2026 historical window but matters if the
  analysis window is moved forward.
- If live retrieval fails and a usable cache exists, the API serves the cache and
  reports a stale-cache warning with the original retrieval timestamp.
- Data is loaded on the first analytics request, not during process startup. The first
  request after a cold start can take several seconds while Elexon is queried.

## Architecture

```text
React + TypeScript + Vite
        |
        |  /api/* and /health
        v
FastAPI application
  - API validation and error contracts
  - Elexon client, retries, seven-day chunking
  - cache and freshness handling
  - forecast selection and evaluation frame
  - KPI, coverage, grouped metrics and data-quality services
        |
        v
Elexon BMRS FUELHH + WINDFOR
```

The backend owns all analytical calculations. The frontend is a presentation layer:
it formats API values, manages filters and loading states, and does not recompute KPIs.

## Local development

### Prerequisites

- Python 3.10-3.12
- Node.js 20+ (verified with Node 24)
- npm
- Docker Desktop or another Docker engine for the container workflow only

### Backend

From the repository root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

API:

- Swagger UI: `http://localhost:8000/docs`
- Health: `http://localhost:8000/health`
- Example: `http://localhost:8000/api/overview?mode=horizon&horizon_hours=24`

The first analytics request downloads and caches the January 2026 datasets. Subsequent
requests use the in-memory data and disk cache.

### Frontend

In a second terminal:

```powershell
cd frontend
npm ci
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:5173`.

`VITE_API_URL` must be the backend origin without `/api` or a trailing slash. For local
development it is `http://localhost:8000`. If it is empty in a production build, the
frontend calls the same origin (`/api/*`, `/health`), which is the intended nginx/Docker
setup.

## Docker

The Compose stack builds the API and a production frontend served by nginx. nginx proxies
`/api/*` and `/health` to the backend, so the browser uses one origin and no CORS
configuration is needed.

```powershell
Copy-Item .env.example .env
docker compose up --build
```

- Frontend: `http://localhost:8080`
- Backend: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`

The named volume `windsight-cache` persists the Elexon data cache across container
restarts. `docker compose down` keeps it; `docker compose down -v` removes it.

To build the frontend container against a separately hosted API:

```powershell
docker build --build-arg VITE_API_URL=https://api.example.com -t windsight-frontend .\frontend
```

In that standalone case, replace the nginx `backend:8000` upstream with your API host or
deploy the frontend as a static site instead.

## Configuration

Backend settings are read from environment variables or `backend/.env`. Variable names
are case-insensitive.

| Variable | Default | Purpose |
| --- | --- | --- |
| `ENVIRONMENT` | `development` | Reported by `/health` |
| `CORS_ORIGINS` | local Vite origins | Comma-separated allowed browser origins |
| `ELEXON_BASE_URL` | Elexon BMRS v1 base URL | Upstream API base |
| `REQUEST_TIMEOUT_SECONDS` | `30` | Per-request timeout |
| `MAX_RETRIES` | `3` | Upstream attempts after the first |
| `RETRY_BACKOFF_SECONDS` | `1` | Exponential backoff base |
| `CACHE_DIR` | `data/cache` | Cache directory, resolved under `backend/` when relative |
| `CACHE_TTL_SECONDS` | `86400` | Cache freshness lifetime |
| `DEFAULT_CUTOFF` | `2026-02-01T00:00:00Z` | Default latest-mode cutoff |
| `DEFAULT_HORIZON_HOURS` | `24` | Default horizon |
| `ANALYSIS_START` / `ANALYSIS_END` | January 2026 | Delivery window |
| `FORECAST_HISTORY_START` / `FORECAST_HISTORY_END` | Dec 28-Feb 1 | WINDFOR publication history |

Frontend configuration:

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | API origin used by the browser. Empty means same-origin. Must be set at build time. |

Do not commit real `.env` files. Only the provided `.env.example` files belong in version
control.

## API

All endpoints are `GET`. `start_date` and `end_date` accept `YYYY-MM-DD` and are optional.
Common forecast-selection parameters:

| Parameter | Values | Notes |
| --- | --- | --- |
| `mode` | `horizon`, `latest` | Defaults to `latest` in the API |
| `horizon_hours` | positive number | Required for horizon mode |
| `cutoff` | ISO-8601 UTC timestamp | Used by latest mode |

| Endpoint | Description |
| --- | --- |
| `GET /health` | Process health and whether data has been loaded |
| `GET /api/overview` | KPIs, coverage, daily metrics, and actual/forecast series |
| `GET /api/accuracy` | Metric set, grouped metrics, and error series |
| `GET /api/actuals` | FUELHH actual generation series |
| `GET /api/forecasts` | Selected forecast series |
| `GET /api/records` | One row per half-hourly delivery interval |
| `GET /api/forecast-history` | Every retained forecast version for one interval |
| `GET /api/data-quality` | Coverage, ingestion counts, and warnings |
| `GET /openapi.json` | OpenAPI schema |
| `GET /docs` | Swagger UI |

Examples:

```text
GET /api/overview?mode=horizon&horizon_hours=24
GET /api/accuracy?mode=latest&cutoff=2026-01-15T00:00:00Z
GET /api/records?start_date=2026-01-10&end_date=2026-01-12&mode=horizon&horizon_hours=12
GET /api/forecast-history?delivery_start=2026-01-20T18:00:00Z&mode=horizon&horizon_hours=24
```

Validation and upstream failures use structured JSON errors with an `error` code and a
human-readable `detail`:

- `400` invalid request
- `502` upstream error
- `503` data unavailable or incomplete
- `500` internal analysis error

Query and payload validation rejects malformed dates, invalid horizons, and non-finite
numbers (`NaN`, `inf`, `-inf`). Validation failures are normalized to a structured
`400 invalid_request` response rather than FastAPI's default `422` body.

## Deployment

The repository includes `render.yaml` for a Render Blueprint, `frontend/vercel.json` for
Vercel, and Dockerfiles for any container host. The nginx, Render, and Vercel
configurations set `X-Content-Type-Options: nosniff`, `X-Frame-Options`,
`Referrer-Policy`, and a restrictive `Permissions-Policy`.

### Option A: Render backend and Vercel frontend

1. Push the repository to GitHub.
2. In Render, create a Blueprint from `render.yaml`. This creates:
   - `windsight-api` as a Docker web service with health check `/health`.
   - `windsight-web` as a static site.
3. Set the API's `CORS_ORIGINS` to the deployed frontend origin, for example
   `https://windsight.vercel.app`. Use a comma-separated list if you have several origins.
4. Deploy the frontend from the `frontend/` directory on Vercel (framework preset: Vite).
5. Set `VITE_API_URL` in Vercel to the Render API origin, for example
   `https://windsight-api.onrender.com`. Do not append `/api`.
6. Redeploy the frontend after changing `VITE_API_URL`, because Vite embeds it at build
   time.
7. If you use the Render static site instead of Vercel, set `VITE_API_URL` during its
   build and set the API's `CORS_ORIGINS` to the static site origin.

### Option B: Full Docker stack on one host

Run the Compose stack behind a TLS-terminating reverse proxy or platform load balancer.
The bundled nginx serves the SPA and proxies the API on the same origin. Keep the cache
volume mounted and expose only the frontend port publicly.

### Operations notes

- Render's free filesystem is ephemeral. The cache will be lost on restart, and the app
  will refetch Elexon data on the next analytics request. Use a persistent disk on a
  paid plan if cache persistence matters.
- Render free services can spin down. The first request after a cold start may take
  longer because the process and Elexon data must load. A verified clean-cache cold
  request against Elexon took about 7 seconds.
- Set `CACHE_TTL_SECONDS=0` to treat any on-disk cache as stale when a dataset is loaded.
  The TTL is evaluated at load time, not on every request; an in-memory dataset is not
  refreshed until the process restarts.
- CORS values are origins only: scheme plus host plus optional port, with no path and no
  trailing slash.
- The frontend must be rebuilt to change `VITE_API_URL`.
- Never expose upstream credentials or secrets to the frontend. The current data source
  is public and no API keys are required.
- The bundled production frontend makes same-origin requests only; no backend address
  is embedded in the built JavaScript. Keep the API behind the same origin or set
  `VITE_API_URL` explicitly at build time.

## Testing

Backend, from `backend/`:

```powershell
python -m pytest
```

Verified result: **39 passed** on the local Python 3.10 environment and inside the
deployed Python 3.12 / Starlette 1.10 container.

An independent, standard-library-only cross-check reads the raw cache directly and does
not import application analytics code:

```powershell
python scripts/independent_verify.py --base-url http://localhost:8080
```

Verified result: **11/11 views passed**. It recomputes selection and KPIs for horizons
3, 6, 12, 24, 36, 48, 60 and 72 hours plus three latest-mode cutoffs. It also checks
exact-cutoff inclusion, post-cutoff exclusion, and the number of half-hour pairs that
legitimately use different forecast versions.

Frontend, from `frontend/`:

```powershell
npm run typecheck
npm test
npm run build
```

Verified result: typecheck passed, **9 tests passed**, production build passed. Vite
reports a chunk-size warning because the Recharts-based analytics bundle is larger than
500 kB; this does not fail the build.

Browser smoke tests use Playwright and run against the built Docker stack:

```powershell
npx playwright install chromium
docker compose up -d --build
npm run test:e2e
```

Verified result: **6 passed** against `http://localhost:8080`. The suite covers all four
routes, real-data rendering, 72-hour empty and unavailable states, explorer filtering,
a 1,488-row CSV download, latest-mode warnings, and API failure/retry recovery. It runs
serially because concurrent Recharts-heavy pages are resource-intensive on a local
machine. Set `PLAYWRIGHT_BASE_URL` to test another deployed origin.

Backend and frontend unit tests use synthetic fixtures and mocked upstream data. They do
not depend on live Elexon availability. The Playwright suite uses the cached real-data
Docker deployment and does not call Elexon.

Dependency audit as of this verification:

- `pip-audit -r backend/requirements.txt`: **no known vulnerabilities**.
- `npm audit --omit=dev`: **0 production vulnerabilities** after upgrading React Router to
  7.18.4.
- Full `npm audit`: **9 dev-only advisories** (5 moderate, 2 high, 2 critical) in Vite,
  Vitest, PostCSS, Tailwind, esbuild, tinypool, and related build tooling. These affect
  local development/build servers, not the static production output. Do not expose the
  Vite dev server publicly; upgrade the development toolchain before treating it as a
  long-lived maintenance baseline.

## Project structure

```text
windsight/
├── backend/
│   ├── app/
│   │   ├── analytics/          # Forecast selection and metric calculations
│   │   ├── api/                # FastAPI routes and query validation
│   │   ├── schemas/            # Pydantic response contracts
│   │   ├── services/           # Elexon client, cache, ingestion, analysis
│   │   ├── config.py           # Environment-driven settings
│   │   └── main.py             # Application factory and error handlers
│   ├── data/cache/             # Local Elexon cache, ignored by git
│   ├── scripts/                # Independent real-data verification
│   ├── tests/                  # Backend unit and API tests
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/         # Layout, charts, data states, shared UI
│   │   ├── context/            # Global analysis selection state
│   │   ├── pages/              # Overview, Accuracy, Evolution, Explorer
│   │   ├── services/           # Typed API client
│   │   └── utils/              # Formatting and CSV export
│   ├── e2e/                    # Playwright browser smoke tests
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── playwright.config.ts
│   └── vercel.json
├── docker-compose.yml
├── render.yaml
├── .env.example
├── AUDIT_REPORT.md
└── README.md
```

## Limitations

- FUELHH and WINDFOR are both national wind datasets. No other fuel type, demand,
  price, or procurement quantity is included.
- Hourly WINDFOR values are repeated across the two half-hourly settlement periods in
  their forecast hour. This does not add forecast resolution or create independent
  hourly samples. For inferential uncertainty, the effective sample size is closer to
  the number of forecast hours than the number of half-hourly observations.
- WINDFOR publication revisions can change the latest available forecast for an
  already-delivered interval. The app shows version history but does not claim to
  reconstruct a complete market snapshot beyond retained Elexon data.
- The default latest-mode cutoff is after January 2026, so it includes post-delivery
  publications. Use horizon mode for a decision-time view.
- The forecast horizon is a configurable analysis window, not the day-ahead market
  deadline.
- Forecast accuracy metrics are descriptive statistics for this period, not a forecast
  of future accuracy or a trading recommendation.
- The 72-hour horizon option currently returns zero matches because the retained forecast
  history has a maximum lead of 66.5 hours. Use 36 hours or less for full coverage and
  48 hours for about 81% coverage.
- In-memory data is not automatically refreshed when the cache TTL expires; a process
  restart is required. This is intentional for the fixed historical window but would
  need revisiting for a rolling window.
- The free Render deployment has no persistent cache and may cold-start slowly.
- No live Render/Vercel URL was available during this audit. Public deployment behavior,
  hosted environment variables, CORS, and cold starts remain unverified; the local
  Docker stack was verified end to end.
