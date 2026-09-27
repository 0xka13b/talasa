# Data sources

Each external source has its own typed client package in `packages/`. The table
shows what each one is used for and what it needs.

| Source | Package | Used for | Needs | Without it |
|---|---|---|---|---|
| [Equasis](https://www.equasis.org) | `equasis` | Ship particulars, ownership, history, inspections, fleets, company search | Free account (`EQUASIS_EMAIL`, `EQUASIS_PASSWORD`) | Vessel screenings fail at `identify`; DD has no fleet or network |
| [OpenSanctions](https://www.opensanctions.org) via local [yente](https://github.com/opensanctions/yente) | `opensanctions` | Sanctions, PEP and POI matching | Docker (`pnpm yente:up`) or a hosted API key | Sanctions recorded as a data gap |
| [GLEIF](https://www.gleif.org) | `gleif` | LEI records and corporate parents | Nothing (public API) | Ownership recorded as a data gap |
| [Datalastic](https://datalastic.com) | `datalastic` | 90-day AIS history; vessel dimensions for the satellite check | Paid API key (`DATALASTIC_API_KEY`) | AIS recorded as a data gap |
| [Copernicus Data Space](https://dataspace.copernicus.eu) | `copernicus` | Sentinel-1 / Sentinel-2 imagery for the on-demand STS check | Free account (`CDSE_CLIENT_ID`, `CDSE_CLIENT_SECRET`) | Satellite check unavailable |
| Google Maps Platform | — | Place names for AIS events; interactive and PDF maps | API keys (`GOOGLE_MAPS_API_KEY`, `VITE_GOOGLE_MAPS_API_KEY`) | Offline port/sea labels only; no map |
| [Exa](https://exa.ai) | — | Web search in Ask Agent | API key (`EXA_API_KEY`) | Agent works without web search |
| LLM (OpenAI-compatible, OpenRouter by default) | `inference` | Report narratives, ownership inference, entity tie-breaks, Ask Agent | `INFERENCE_URL`, `INFERENCE_API_KEY`, `INFERENCE_MODEL` | New reports fail at the final stage |
| [GDELT](https://www.gdeltproject.org) | `gdelt` | Client for news / adverse-media search. **Not used by any pipeline yet** | Nothing | — |

## Terms of use and licensing

Talasa's AGPL-3.0 licence covers its code, not the data. Before using the data
commercially, check each provider's terms.

**Equasis** has no API; the client scrapes the website with a logged-in session.
Equasis is built for interactive use, so read its terms before automating
access. Accounts have been suspended for aggressive scraping.
- **Throttle:** every Equasis client waits `EQUASIS_MIN_REQUEST_INTERVAL_MS`
  between requests, default **30 seconds**. Do not lower it.
- **Separate clients:** the API and worker each have their own client, so their
  combined rate can exceed one request per 30 seconds when both are busy.

**OpenSanctions**
- **Default data:** the local yente default (`YENTE_MANIFEST=civic`) loads the
  public dataset, which is licensed for **non-commercial use only**.
- **Commercial use:** you need an OpenSanctions data licence, then set
  `YENTE_MANIFEST=commercial` and `OPENSANCTIONS_DELIVERY_TOKEN`.
- **Hosted API:** to use it instead of yente, set
  `OPENSANCTIONS_BASE_URL=https://api.opensanctions.org` and
  `OPENSANCTIONS_API_KEY`.

**Datalastic** is a paid service billed in credits.
- **Tier:** the code targets the Starter tier.
- **Add-ons:** the add-on endpoints (satellite AIS, route tracking, ownership)
  return 403 on Starter, which looks the same as a bad key.
- **Cost:** `/vessel_history` costs about one credit per day of history per
  vessel.

**Copernicus** image processing uses processing units from a free monthly
quota, which is why satellite checks run on demand and are cached.

**GLEIF** data is open (CC0). The client stays at one request per second,
under GLEIF's limit of 60 requests per minute.

## Rate limits and throttles

| Source | Default gap between requests | Setting |
|---|---|---|
| Equasis | 30 s | `EQUASIS_MIN_REQUEST_INTERVAL_MS` |
| GLEIF | 1 s | `GLEIF_MIN_REQUEST_INTERVAL_MS` |
| Datalastic | 1 s | `DATALASTIC_MIN_REQUEST_INTERVAL_MS` |
| Google Geocoding | 120 ms | `GOOGLE_GEOCODE_MIN_REQUEST_INTERVAL_MS` |
| Copernicus | 500 ms | not configurable |
| OpenSanctions / yente | none | — |

The throttled clients send requests one at a time, with this gap between
them.

## Adding a source

Each client package follows the same pattern:
- a typed client class with a config object
- a serialized request throttle
- zod-validated responses
- typed errors
- tests against recorded fixtures

`packages/datalastic` and `packages/gleif` are small examples to copy. A client
is built from environment variables in `apps/jobs/src/clients.ts` (worker) or
in the API service that uses it.
