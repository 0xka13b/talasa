# Configuration

Configuration lives in the repo-root `.env`, which you create with
`cp .env.example .env`:
- the API, the worker and the database scripts read it at start-up
- Docker Compose reads it for ports and credentials
- the platform reads its `VITE_*` values at build time

Only the database and auth settings are required. Everything else has a
default or turns a feature off when blank.

In the **App** column: *api* is `apps/api`, *jobs* is the worker, *platform* is
the web app, *compose* is the Docker Compose files.

## Core

| Variable | App | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | api, jobs, db | — | **Required.** Postgres connection string |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | compose | `talasa` | Local database credentials |
| `POSTGRES_PORT`, `ADMINER_PORT` | compose | `5432`, `8080` | Change if the ports are taken, and update `DATABASE_URL` to match |
| `BETTER_AUTH_SECRET` | api | — | **Required.** Generate with `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | api | — | **Required.** The API's own URL, e.g. `http://localhost:8787` |
| `CORS_ORIGIN` | api | — | **Required.** The platform URL(s), comma-separated |
| `PORT` | api | `8787` | API port |
| `VITE_API_URL` | platform | — | API URL as seen from the browser |
| `LOG_LEVEL` | jobs | `info` | Worker log level (pino) |

## LLM

| Variable | App | Default | Notes |
|---|---|---|---|
| `INFERENCE_URL` | api, jobs | `https://openrouter.ai/api/v1` (jobs) | OpenAI-compatible endpoint |
| `INFERENCE_API_KEY` | api, jobs | — | |
| `INFERENCE_MODEL` | api, jobs | — | Model for report narratives; also the default for chat |
| `INFERENCE_MAX_TOKENS` | jobs | `2000` | Max output tokens per report call |
| `DD_RESOLVER_MODEL` | jobs | `INFERENCE_MODEL` | Cheaper model for DD entity tie-breaks |
| `CHAT_MODEL` | api | `INFERENCE_MODEL` | Ask Agent model; must support tool calls |
| `VISION_MODEL` | api | `qwen/qwen3-vl-32b-instruct` | Reads satellite chips in Ask Agent |
| `INFERENCE_FALLBACK_URL`, `INFERENCE_FALLBACK_API_KEY`, `INFERENCE_FALLBACK_MODEL` | api, jobs | — | Optional second provider, tried when the primary fails |

## Data sources

| Variable | App | Default | Notes |
|---|---|---|---|
| `EQUASIS_EMAIL`, `EQUASIS_PASSWORD` | api, jobs | — | Equasis account |
| `EQUASIS_BASE_URL` | api, jobs | `https://www.equasis.org/EquasisWeb` | |
| `EQUASIS_MIN_REQUEST_INTERVAL_MS` | api, jobs | `30000` | Don't lower it (see [data-sources.md](data-sources.md)) |
| `OPENSANCTIONS_BASE_URL` | jobs | `http://localhost:8000` | Local yente; or `https://api.opensanctions.org` |
| `OPENSANCTIONS_API_KEY` | jobs | — | Only for the hosted API |
| `GLEIF_BASE_URL` | jobs | `https://api.gleif.org/api/v1` | |
| `GLEIF_MIN_REQUEST_INTERVAL_MS` | jobs | `1000` | |
| `DATALASTIC_API_KEY` | api, jobs | — | Blank = no AIS analysis |
| `DATALASTIC_BASE_URL` | api, jobs | `https://api.datalastic.com/api/v0` | |
| `DATALASTIC_MIN_REQUEST_INTERVAL_MS` | api, jobs | `1000` | |
| `VESSEL_AIS_HISTORY_DAYS` | jobs | `90` | AIS lookback (~1 credit per day) |
| `GOOGLE_MAPS_API_KEY` | jobs | — | Server-side reverse geocoding of AIS events |
| `GOOGLE_GEOCODE_BASE_URL` | jobs | Google Geocoding API | |
| `GOOGLE_GEOCODE_MIN_REQUEST_INTERVAL_MS` | jobs | `120` | |
| `VITE_GOOGLE_MAPS_API_KEY` | platform | — | Browser maps (Maps JavaScript + Static Maps); restrict by HTTP referrer |
| `CDSE_CLIENT_ID`, `CDSE_CLIENT_SECRET` | api | — | Copernicus Data Space; blank = no satellite check |
| `CDSE_BASE_URL` | api | `https://sh.dataspace.copernicus.eu` | |
| `EXA_API_KEY` | api | — | Ask Agent web search |

## Local yente

These are read by `docker-compose.yente.yml`.

| Variable | Default | Notes |
|---|---|---|
| `YENTE_MANIFEST` | `civic` | `civic` = public data (non-commercial); `commercial` = licensed data |
| `OPENSANCTIONS_DELIVERY_TOKEN` | — | Needed for `commercial` |
| `YENTE_PORT` | `8000` | Host port |
| `ELASTICSEARCH_HEAP` | `4g` | `2g` works on smaller machines |

## Worker tuning

| Variable | Default | Notes |
|---|---|---|
| `WORKER_POLL_MS` | `2000` | Sleep between polls when idle |
| `WORKER_LEASE_MINUTES` | `10` (`.env.example`: `45`) | When a `running` row may be reclaimed. Set it above your longest run if you use more than one worker |
| `VESSEL_MAX_SISTERS_PER_COMPANY` | `25` | Sister ship pages fetched per company |
| `VESSEL_MAX_SISTER_PAGES` | `60` | Sister ship pages fetched per screening |
