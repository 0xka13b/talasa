# @talasa/datalastic

Typed client over **[Datalastic](https://datalastic.com)**'s AIS REST API — the only
paid data source in a vessel report, and the one that makes behaviour analysis
possible. `/vessel_history` gives the 90-day track that the deterministic detectors
in `@talasa/shared` chew into dark gaps, STS-candidate loitering and speed
anomalies; everything else here is identity and specs.

Returns trimmed domain objects, not raw payloads. This package is just the client +
types — no jobs, no persistence, no detection logic.

## Usage

```ts
import { DatalasticClient } from "@talasa/datalastic"

const dl = new DatalasticClient({ apiKey: process.env.DATALASTIC_API_KEY! })

// The workhorse: 90-day AIS track (default window), input to the behaviour detectors.
const track = await dl.getVesselHistory({ imo: "9298595" })
// track -> VesselTrack | null  (identity + positions: VesselPosition[])
// each fix -> { lat, lon, speed, course, heading, navStatus, destination, epoch, timeUtc }

await dl.getVesselHistory({ mmsi: "273441990" }, { from: "2026-01-01", to: "2026-03-31" })

// Static specs — length/breadth feed the SAR beam-doubling test.
const specs = await dl.getVesselInfo({ imo: "9298595" })
// specs -> VesselSpecs | null  (grossTonnage, deadweight, length, breadth, draughtMax, yearBuilt, homePort, …)

// Live position. `/vessel_pro` additionally carries currentDraught (a load/discharge proxy) + ETA.
const live = await dl.getVesselPro({ imo: "9298595" })
// live -> VesselLive | null  (position, destination, destPort, etaUtc, currentDraught)
await dl.getVessel({ imo: "9298595" }) // basic: no draught, no ETA

// Area scan — zone monitoring and STS counterparty resolution.
const scan = await dl.getVesselsInRadius({ lat: 25.0, lon: 56.0, radiusNm: 10, type: "Tanker" })
// scan -> { center, total, vessels: RadiusVessel[] }  (each with distanceNm from centre)
```

A `VesselSelector` is **exactly one** of `{ uuid } | { imo } | { mmsi }` — zero or two
throws `DatalasticConfigError` before any network call (and any credit spend).

## Credits — the cost model is not per-call

Datalastic bills "database requests", so a single call can cost 90 credits:

| Endpoint | Method | Credits |
|---|---|---|
| `/vessel`, `/vessel_pro`, `/vessel_info` | `getVessel` / `getVesselPro` / `getVesselInfo` | 1 |
| `/vessel_history` | `getVesselHistory` | **days × 1 vessel** — the 90-day default ≈ 90 |
| `/vessel_inradius` | `getVesselsInRadius` | **1 per vessel returned**, capped at `MAX_INRADIUS_VESSELS` (500) |

Narrow the `days` window and the radius/`type` filter before assuming a call is
cheap. Requests are serialized through an internal throttle (1 req/s by default)
so a burst can never race the rate limit or the credit meter.

> **Why a hard 403 on some endpoints?** We're on Datalastic's **Starter** tier
> (€199/mo, 20k credits). Add-on endpoints — SAT-E, Route Tracking, ownership,
> inspections, casualties — are *not* in Starter and answer **403**, surfaced as
> `DatalasticAuthError`, identical to a bad key. Only the Starter endpoints above
> are exposed here; if a call 403s, check the plan before rotating the key.

## Notes

- **404 → `null`, not a throw.** Unknown vessel is a data gap, not an error. Consumers
  lean on this: the SAR beam check degrades to nulls, and the jobs AIS stage reports
  `available: false` rather than failing the run. A missing `DATALASTIC_API_KEY` yields
  a `null` client for the same reason — the key is optional, the report just loses AIS.
- Raw schemas are deliberately lenient (`.passthrough()`, `numish`): Datalastic nulls
  and omits freely and mixes number/string for the same field across endpoints. The
  `map*` functions coerce via `num()`/`str()`, so domain types are `T | null`, never `NaN`.
- ETA is operator-broadcast. `etaUtc` is a hint, never settlement evidence.
- Errors: `DatalasticAuthError` (401/403), `DatalasticRateLimitError` (429),
  `DatalasticHttpError`, `DatalasticTimeoutError`, `DatalasticConfigError` — all
  extend `DatalasticError`.

## Config

| Option | Default | Notes |
|---|---|---|
| `apiKey` | — | required; sent as an `api-key` **query param**, not a header (`DATALASTIC_API_KEY`) |
| `baseUrl` | `https://api.datalastic.com/api/v0` | `DATALASTIC_BASE_URL` |
| `timeoutMs` | `20000` | history/inradius are heavier than a live lookup |
| `minRequestIntervalMs` | `1000` | `DATALASTIC_MIN_REQUEST_INTERVAL_MS`; 1 req/s, serialized |
