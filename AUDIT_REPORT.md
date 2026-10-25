# WindSight UK — Audit Report

**Audit date:** 26 October 2026  
**Scope:** Full-stack correctness, validation, frontend behavior, dependency security, Docker deployment, and an independent second-pass recomputation of the analytical results.  
**Verified evidence:** Independent raw-data reference **11/11 views passed**; backend tests **39 passed** on local Python 3.10 and deployed Python 3.12; frontend tests **9 passed**; Playwright browser tests **6 passed** against the built Docker stack.  
**Result:** **Pass with low-severity residuals for the locally verified Docker scope.** No accessible public deployment URL was available, so a hosted Render/Vercel deployment remains **not verified**.

---

## 1. Executive summary

WindSight compares Elexon `FUELHH` national wind actuals with `WINDFOR` forecast versions for January 2026, enforces explicit no-look-ahead selection, and computes all KPIs in the Python backend.

The audit confirmed:

- The hourly WINDFOR → half-hourly FUELHH alignment is explicit, documented, and correctly implemented.
- Forecast selection is independently cutoff-constrained for every half-hourly interval.
- Missing data remains null and is never converted to zero.
- Real-data results are internally consistent: 1,488 matched intervals at 24h horizon, 100% coverage, MAE 2,060.560 MW.
- A standard-library reference implementation that does **not import application analytics code** recomputed selection and KPIs from raw Elexon records. It passed **11/11 views**, with exact matched counts, **zero** selection mismatches, **zero** post-cutoff selections, and metric differences of at most **0.000493** from API values rounded to three decimals.
- Backend tests: **39 passed** on local Python 3.10/Starlette 1.7 and inside the Python 3.12/Starlette 1.10 container. Frontend tests: **9 passed**; typecheck and production build passed.
- Playwright browser tests: **6 passed** against the rebuilt Docker stack, covering all four routes, real-data rendering, 72h empty states, explorer filter and 1,488-row CSV export, latest-mode warnings, and API failure/retry recovery.
- Production dependency surface is clean: `npm audit --omit=dev` reports **0 vulnerabilities**; local `pip-audit` and full-image `pip-audit` (after upgrading base-image pip to 26.2.2) report **no known vulnerabilities**.
- The rebuilt Docker stack is healthy, non-root, serves the SPA and API through nginx, persists its cache in a named volume, and embeds no hard-coded local backend address in the production bundle.
- The public Render/Vercel deployment is **not verified** because no hosted URL was supplied.

Residual risks are documented in §9; none blocks the intended historical dashboard use.

---

## 2. Findings

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| C-1 | High | WINDFOR is hourly but FUELHH is half-hourly. Naive joining would lose half of the delivery intervals or imply unsupported sub-hourly detail. | **Fixed** with explicit hour-to-both-half-hours mapping and `forecast_valid_time`. |
| C-2 | High | Forecast selection could leak future publications into earlier decisions. | **Independently verified fixed**: 0 selection mismatches and 0 post-cutoff selections across 11 views; exact-cutoff versions were correctly included. |
| C-3 | High | Empty forecast selections could fail during metric calculation. | **Fixed**; empty selections now return null metrics, zero coverage, and a warning. |
| S-1 | High | CSV export was vulnerable to spreadsheet formula injection. | **Fixed** with formula-prefix neutralization and regression tests. |
| V-1 | Medium | Non-finite horizons (`NaN`, `inf`, `-inf`, overflow) were not explicitly rejected. | **Fixed** with `allow_inf_nan=False` and explicit finite/bounds checks; returns structured 400. |
| V-2 | Medium | FastAPI default validation responses returned 422 with a different error shape. | **Fixed** with a `RequestValidationError` handler normalizing to structured 400 `invalid_request`. |
| F-1 | Medium | Charts connected across missing forecasts/errors, visually implying data that did not exist. | **Fixed** with `connectNulls={false}` in the forecast/actual and error timeline charts. |
| F-2 | Low | The Evolution page showed a generic error when the selected horizon had no eligible interval (notably 72h) and no explicit interval was loaded. | **Fixed** with a clear empty state that explains the horizon constraint and prompts the user to choose an interval or reduce the horizon. |
| D-1 | High | Production React Router 6.x dependency had known advisories. | **Fixed** by upgrading to `react-router-dom` 7.18.4; production audit is clean. |
| D-2 | High | Pinned FastAPI/Starlette and pytest versions had published advisories. | **Fixed** by upgrading FastAPI to 0.162.0, pytest to 9.0.3, and pytest-asyncio to 1.4.0; `pip-audit` is clean. |
| D-3 | Low | The Python 3.12 base image shipped pip 25.0.1 with 12 published advisories. | **Fixed** by pinning pip 26.2.2 in `backend/Dockerfile`; full-image `pip-audit` is now clean. |
| H-1 | Medium | Missing browser hardening headers on nginx/Render/Vercel. | **Fixed** for nosniff, frame options, referrer policy, and permissions policy. |
| R-1 | Low | In-memory data is not refreshed when the disk-cache TTL expires. | **Accepted/documented** for the fixed historical window. |
| R-2 | Low | The 72h horizon returns zero matches because the longest retained lead is 66.5h. | **Documented**; valid 200 response with warning, not a defect. |
| R-3 | Low | Production JS bundle is ~677 kB and Vite emits a chunk-size warning. | **Accepted**; build succeeds and gzip size is ~189 kB. |
| R-4 | Low | Full npm audit still reports 9 development/build-tool advisories. | **Accepted**; production dependencies are clean and dev servers must not be public. |
| R-5 | Low | No accessible public Render/Vercel URL was supplied. | **Not verified**; deployment configuration was reviewed statically and the Docker stack was tested end to end. |
| R-6 | Low | Browser coverage is Chromium-only. | **Accepted** for this audit; add Firefox/WebKit if cross-browser support becomes a requirement. |

---

## 3. Correctness and analytical semantics

### 3.1 Hourly forecast alignment

Elexon WINDFOR is an hourly national forecast; FUELHH actuals are half-hourly. Elexon documentation and search excerpts describe WINDFOR as an hourly forecast published up to eight times per day. The raw cache independently confirms 280 forecast publications containing 73 hourly values each, with every WINDFOR `startTime` on a whole hour.

- Source hour is exposed as `forecast_valid_time`.
- No interpolation or synthetic sub-hourly detail is introduced.
- Each of the two half-hours independently selects its latest eligible forecast, so `:00` and `:30` can legitimately use different forecast versions.
- Deduplication is on `(startTime, publishTime)` for forecasts and on `startTime` (latest publication) for actuals.

This behavior is covered by alignment, boundary, and per-half-hour cutoff tests. On real data, 248 half-hour pairs at horizons 3–36h legitimately selected different forecast versions because the two intervals have different cutoffs; the count was 217 at 48h, 124 at 60h, and 0 at 72h.

### 3.2 No-look-ahead selection

For horizon mode, interval `t` uses cutoff `t - horizon_hours`, selecting the latest forecast with `publishTime <= cutoff`. A forecast published after the decision time cannot be selected, even if it is the latest version overall. Latest mode uses one explicit global cutoff and labels the result as retrospective.

### 3.3 Missing data

Missing values remain `null`. No KPI calculation fills them with zero or carries values forward. Matched KPIs use only intervals where both actual and eligible forecast exist.

### 3.4 Real-data verification

| Metric / view | Verified result |
| --- | --- |
| Expected half-hour intervals | 1,488 |
| FUELHH actuals | 1,488 |
| Raw WINDFOR records | 20,440 |
| WINDFOR records for January delivery hours | 18,080 |
| Forecast publications | 280 publications × 73 hourly values |
| Forecast hours / versions | 744 January hours; 16–32 versions per hour, median 24 |
| Maximum retained lead | 66.5h |
| 24h matched coverage | 1,488 / 1,488 = 100% |
| 24h MAE | 2,060.560 MW |
| 24h RMSE | 2,521.295 MW |
| 24h WAPE | 17.793% |
| 24h mean error | +1,848.934 MW |
| 24h max absolute error | 6,804.0 MW |
| 48h matched coverage | 1,209 / 1,488 = 81.25% |
| 48h MAE | 2,393.247 MW |
| 60h matched coverage | 465 / 1,488 = 31.25% |
| 72h matched coverage | 0 |
| Latest cutoff 2026-02-01T00:00Z | 1,488 matched; MAE 1,771.900 MW; RMSE 2,268.193 MW; WAPE 15.300%; mean error +1,596.778 MW; max absolute error 7,228.0 MW |

The independent reference implementation read the raw cache directly and compared its selected records with `/api/records` for all 1,488 intervals. Results:

- Matched counts were exact for every horizon and latest cutoff.
- MAE, RMSE, WAPE, mean error, and max absolute error differed from the API by at most **0.000493** MW or percentage points, consistent with API rounding to three decimals.
- Selection mismatches: **0** across 11 views. Forecast-value mismatches: **0**.
- Post-cutoff candidates were never selected: **0 of 8,634–36,160** horizon-mode candidates, depending on horizon.
- Exact-cutoff versions were included: **247/247** at 3–36h, **216/216** at 48h, and **124/124** at 60h.
- Latest mode correctly selected and warned about post-delivery publications: 1,485 of 1,488 at the default cutoff, 669 at 2026-01-15T00:00Z, and 455 at 2026-01-10T12:30Z.

### 3.5 Horizon coverage

| Horizon | Matched coverage |
| --- | --- |
| 3h / 6h / 12h / 24h / 36h | 100% |
| 48h | 81.25% |
| 60h | 31.25% |
| 72h | 0% |

The 72h result is expected: the retained forecast history begins 2025-12-28 and the longest stored lead is 66.5 hours. The API returns HTTP 200 with null metrics, zero coverage, and a warning. This is documented in the README and the Evolution page has a dedicated empty state, verified in Chromium.

---

## 4. Validation and error contract

Verified behaviors:

| Input | Response |
| --- | --- |
| `horizon_hours=nan`, `inf`, `-inf`, `1e309` | structured `400 invalid_request` |
| `horizon_hours=0` or `0.1` | structured `400 invalid_request` |
| `start_date=not-a-date` | structured `400 invalid_request` |
| Invalid mode | structured `400 invalid_request` |
| Nonexistent route | `404` |
| No eligible forecasts (72h) | `200` with null metrics and warning |

Implementation:

- `Settings` and raw Elexon schemas use `allow_inf_nan=False`.
- Analysis service validates horizon finiteness and bounds before analytics.
- `RequestValidationError` and domain invalid-request errors are normalized to `{ "error": "invalid_request", "detail": "..." }`.
- Upstream failures remain structured 502/503 responses with retry/cache fallback.

Tests cover non-finite horizons, malformed dates, non-finite raw generation values, invalid modes, and boundary horizons.

---

## 5. Frontend review

- The frontend formats API values and does not recompute KPIs.
- CSV export neutralizes formula-leading cells and preserves the forecast source hour.
- Forecast/actual and error charts no longer connect across null gaps.
- Forecast-hour wording explains the hourly-to-half-hourly mapping on Overview, Accuracy, Evolution, and Explorer surfaces.
- The production bundle contains no `127.0.0.1:8001`, `localhost:8000`, or embedded backend origin. Docker uses same-origin `/api` and `/health`.
- React Router 7.18.4 works with the existing routes; typecheck, 9 unit tests, production build, and 6 Chromium E2E tests pass.
- The SPA fallback works: `/accuracy` and `/evolution` through nginx return `index.html` with HTTP 200.
- Playwright verified all four routes against the Docker stack, the 72h empty state, latest-mode warnings, API failure followed by successful retry, and a complete 1,488-row explorer CSV download.
- The exported CSV had 1,489 lines including the header, used empty cells for missing values, and preserved the forecast valid hour.
- Playwright runs serially. Six concurrent Recharts-heavy pages saturated the local audit machine and caused timeouts; this is a test-resource choice, not a production functional failure.

Residual UX notes:

- A 72h selection produces an empty visual/empty metrics state rather than an error. The API warning explains why; the controls remain selectable.
- At 72h, the Evolution page shows the dedicated "No eligible interval for this horizon" empty state, verified in the browser. Selecting an explicit date/time still shows the retained version history with zero eligible versions.

---

## 6. Security review

### 6.1 Dependencies

| Check | Result |
| --- | --- |
| `pip-audit -r backend/requirements.txt` | **No known vulnerabilities** |
| `pip-audit` inside the rebuilt backend container after pip 26.2.2 upgrade | **No known vulnerabilities** |
| `npm audit --omit=dev` | **0 vulnerabilities** |
| Full `npm audit` | 9 dev-only advisories: 5 moderate, 2 high, 2 critical |

The full npm findings are confined to Vite/Vitest/PostCSS/Tailwind/esbuild/tinypool development and build tooling. They do not ship in the static production output. Do not expose the Vite dev server publicly. Adding `@playwright/test` 1.64.1 did not change the production dependency audit.

### 6.2 Headers

The production frontend sets:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

Hashed `/assets/*` files are served with `Cache-Control: max-age=31536000`; `index.html` is `no-cache`.

### 6.3 Runtime and secrets

- Backend container runs as `uid=10001(windsight)`, non-root.
- Cache files are owned by `windsight:windsight`.
- No upstream credentials are required; no secrets are exposed to the frontend.
- CORS allows the configured frontend origin only; the production Docker browser path is same-origin and does not need CORS.

### 6.4 Residual security gaps

- No Content-Security-Policy is set. Add one at the TLS reverse proxy after validating the Recharts/inline-style requirements.
- No HSTS header in the bundled HTTP-only nginx configuration. Enable it at the TLS terminator.
- No application-level rate limiting or upstream-response size cap beyond schema/parsing controls. For a public deployment, add edge rate limiting and monitor Elexon usage.
- No host-header allowlist/TrustedHost middleware. The current app has no path- or host-based authorization, so the reported Starlette host/path issues do not expose an authorization boundary here, but a public deployment should still terminate at a controlled proxy.
- No authentication is present. That is consistent with a public, read-only dashboard, but any write/admin surface added later must add authorization.

---

## 7. Deployment and Docker verification

Verified after a clean rebuild:

- Backend: `windsight-backend-1`, port `8000`, healthy.
- Frontend: `windsight-frontend-1`, port `8080`, healthy.
- Backend image: Python 3.12 slim, FastAPI 0.162.0, Starlette 1.10.0, pip 26.2.2, non-root `windsight` user.
- Frontend image: Node 24 build stage; nginx 1.27.5 runtime; production JS 677.37 kB (189.32 kB gzip), CSS 25.65 kB.
- Cache volume `windsight-cache` persists `FUELHH` and `WINDFOR` JSON across rebuilds.
- Health endpoint: `{"status":"ok","service":"WindSight UK API","environment":"production","data_loaded":false}` before the first analytics request.
- First analytics request after a clean volume fetched Elexon successfully in ~7.2s: 1,488 actuals, 18,080 forecast records, `retrieval_source=upstream`, `cache_state=fresh`.
- Subsequent requests load from the persisted cache; after the final rebuild, `/api/overview` reported `retrieval_source=cache`, `actual_records=1488`, `forecast_records=18080`, `cache_state=fresh`.
- The frontend returns the SPA shell for deep routes (`/accuracy`, `/evolution`) and serves hashed assets with one-year cache headers.
- Playwright ran 6/6 tests successfully against the rebuilt Docker stack. The suite warms the API first and accounts for cold cache loading.
- Full container `pip-audit` found 12 pip advisories before the upgrade and none after pinning pip 26.2.2.

Known deployment constraints:

- No accessible public Render/Vercel URL was supplied. Hosted build variables, CORS, platform headers, cold starts, and health checks were reviewed statically but **not verified live**.
- Render free filesystems are ephemeral; the cache is refetched after restart. Use a persistent disk if this matters.
- The app is a single-process, in-memory analysis service. Multiple workers each load their own copy; keep one worker or externalize the cache before scaling out.
- Backend tests pass on both runtime matrices: local Python 3.10/Starlette 1.7.0 and Docker Python 3.12/Starlette 1.10.0, **39 passed each**. Add CI for the deployed version to prevent drift.

---

## 8. Evidence and commands

Backend:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q
# 39 passed
.\.venv\Scripts\python.exe -m pip_audit -r requirements.txt --progress-spinner off
# No known vulnerabilities found
.\.venv\Scripts\python.exe scripts\independent_verify.py --base-url http://localhost:8080 `
  --csv-out "$env:TEMP\windsight-independent-metrics.csv" `
  --records-out "$env:TEMP\windsight-independent-records-24h.csv"
# 1,488 independently selected records; RESULT: PASS (11/11 views)
```

The independent script imports only the standard library, reads the raw cache directly, and does not import `app.analytics`. Its 24h record export had 1,489 lines including the header.

Frontend:

```powershell
cd frontend
npm test -- --run        # 9 passed
npm run typecheck        # passed
npm run build            # passed; 677.37 kB JS, 189.32 kB gzip
npm audit --omit=dev     # 0 vulnerabilities
npm audit                # 9 dev-only advisories
npm run test:e2e         # 6 passed against http://localhost:8080
```

Docker and deployment runtime:

```powershell
docker compose up -d --build
docker compose ps
docker compose exec backend id
docker compose exec backend sh -c "ls -l /app/data/cache"
docker run --rm -v "${PWD}\backend:/app:ro" -w /app --tmpfs /tmp `
  windsight-backend:latest python -m pytest -q
# 39 passed on Python 3.12 / Starlette 1.10
docker run --rm --user root windsight-backend:latest sh -c `
  "pip install --no-cache-dir -q pip-audit && pip-audit --progress-spinner off"
# No known vulnerabilities found (pip 26.2.2)
```

Endpoint matrix through nginx (`http://localhost:8080`) verified HTTP 200 for overview, accuracy, records, actuals, forecasts, data-quality, forecast-history, and forecast-history by delivery interval; structured 400 for non-finite/invalid horizons and malformed dates; 404 for unknown routes.

Header check verified nginx `nosniff`, `SAMEORIGIN`, referrer policy, permissions policy, no-cache HTML, and one-year immutable hashed assets. Deep routes `/accuracy` and `/evolution` returned HTTP 200 with the SPA shell.

---

## 9. Residual risks and recommendations

| Risk | Severity | Recommendation |
| --- | --- | --- |
| In-memory data does not refresh when TTL expires | Low | Accept for fixed January 2026 data; if moving to a rolling window, add periodic background refresh or a TTL check on each request that reloads safely. |
| 72h horizon yields no data at current history | Low | Keep as valid request with warning; the UI now provides a dedicated empty state. |
| Dev dependency advisories | Low | Upgrade Vite/Vitest/PostCSS/Tailwind tooling in a dedicated maintenance change with full test/build verification. |
| Bundle size warning | Low | Code-split Recharts/pages if startup performance becomes a requirement; gzip size is ~189 kB today. |
| No CSP/HSTS/rate limiting | Medium for public exposure | Add at the TLS proxy/edge. Validate CSP against Recharts; add HSTS only on HTTPS and rate limits for public traffic. |
| No live public deployment test | Low | Validate Render/Vercel environment variables, CORS origins, cold-start behavior, and health checks in a staging deployment. No hosted URL was available. |
| E2E coverage is Chromium-only | Low | Add Firefox/WebKit projects if cross-browser support is required; the current suite is serial because chart-heavy pages saturate the local machine when parallelized. |
| Runtime version drift | Low | Both local 3.10 and deployed 3.12 suites pass; add CI for the deployed version and re-run `pip-audit` on every dependency change. |

---

## 10. Verdict

**Pass for the locally verified Docker scope — not yet verified as a live public deployment.**

The core analytical behavior is correct and explicitly documented. An independent standard-library implementation reproduced the selection and KPIs from raw records, with zero selection mismatches and metric differences limited to API rounding. Look-ahead is prevented; missing data is represented honestly; high-severity dependency and validation issues were remediated; and the Docker deployment was rebuilt, tested in its deployed Python runtime, and exercised with six Chromium browser tests.

No accessible Render/Vercel URL was provided. Hosted configuration is reviewed statically but is not proven end to end. Before a public launch, complete a staged deployment check, add CSP/HSTS/rate limiting at the edge, and decide whether Firefox/WebKit coverage is required.

Do not present these descriptive January 2026 metrics as live trading guidance.

---

## Appendix: principal files changed or verified

### Backend
- `backend/app/analytics/selection.py` — hourly alignment, per-interval cutoffs, empty-selection handling, `forecast_valid_time`.
- `backend/app/analytics/metrics.py` — KPI/coverage formulas.
- `backend/app/services/analysis_service.py` — validation, horizon bounds, non-finite rejection, forecast history, records.
- `backend/app/services/data_service.py` — cache/freshness, warnings, in-memory lifecycle.
- `backend/app/services/elexon_client.py` — FUELHH/WINDFOR retrieval, chunking, retries, validation.
- `backend/app/services/parsing.py` — parsing, deduplication, invalid/missing handling.
- `backend/app/schemas/raw.py` — raw schemas with `allow_inf_nan=False`.
- `backend/app/schemas/responses.py` — response contracts incl. `forecast_valid_time`.
- `backend/app/api/routes.py` — API query parameters and routes.
- `backend/app/config.py` — settings, horizon bounds, `allow_inf_nan=False`.
- `backend/app/main.py` — structured validation/error handlers.
- `backend/tests/test_api.py`, `test_parsing.py`, `test_selection.py`, `test_metrics.py` — unit, API, missing-data, and regression coverage.
- `backend/scripts/independent_verify.py` — standard-library-only raw-data selection/KPI reference, exact-cutoff and post-cutoff checks, and record export.
- `backend/Dockerfile` — non-root runtime and pinned pip 26.2.2.
- `backend/requirements.txt` — FastAPI 0.162.0, pytest 9.0.3, pytest-asyncio 1.4.0.

### Frontend
- `frontend/src/utils/csv.ts` — formula-injection mitigation and forecast-hour export.
- `frontend/src/utils/csv.test.ts` — CSV regression tests.
- `frontend/src/types/api.ts` — API types incl. `forecast_valid_time`.
- `frontend/src/pages/ExplorerPage.tsx`, `EvolutionPage.tsx`, `OverviewPage.tsx`, `AccuracyPage.tsx` — hourly alignment explanations, forecast-hour display, and 72h empty state.
- `frontend/src/components/charts/ForecastActualChart.tsx`, `ErrorTimelineChart.tsx` — `connectNulls={false}`.
- `frontend/src/components/layout/SelectionControls.tsx` — mode/cutoff/horizon controls.
- `frontend/src/services/api.ts` — same-origin API base handling.
- `frontend/e2e/windsight.spec.ts`, `frontend/e2e/global-setup.ts`, `frontend/playwright.config.ts` — six Chromium browser tests and API warm-up.
- `frontend/package.json` / `package-lock.json` — React Router 7.18.4 and `@playwright/test` 1.64.1.
- `frontend/nginx.conf` — security headers and SPA/API proxying.
- `render.yaml`, `frontend/vercel.json` — deployment headers.

### Deployment
- `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile` — non-root backend, cache volume, same-origin nginx, pinned pip.
- `README.md` — updated test counts, independent verification, Playwright setup, validation behavior, coverage, caching, security, and unverified hosted deployment.
- `AUDIT_REPORT.md` — second-pass evidence and corrected claims.
