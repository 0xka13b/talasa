# @talasa/copernicus

Typed client over the **Copernicus Data Space Ecosystem (CDSE)** Sentinel Hub
APIs — satellite imagery for vessel detection. Sentinel-1 SAR (all-weather,
day/night radar) is the workhorse for spotting **AIS-dark vessels**: calm water
is radar-dark, metal hulls are bright.

## Auth

OAuth2 client-credentials, not a query-param key. Mint a **Client ID + Secret**
in the CDSE dashboard (Sentinel Hub → OAuth clients). The client exchanges them
for a bearer token, caches it until near expiry, and refreshes transparently.

```ts
import { CopernicusClient } from "@talasa/copernicus"

const cop = new CopernicusClient({
  clientId: process.env.CDSE_CLIENT_ID!,
  clientSecret: process.env.CDSE_CLIENT_SECRET!,
})
```

## Cost model — check before you pay

Two surfaces, split by cost:

| Method | API | Cost |
| --- | --- | --- |
| `searchScenes()` | STAC catalog | **FREE** — no processing units |
| `getImage()` / `sarChip()` | Process | **PU-metered** — scales with `width × height × bands` |

The free tier is a monthly PU + openEO-credit quota that resets on the 1st and
does not roll over. **Always `searchScenes()` first** to confirm imagery exists
(and, for optical, inspect cloud cover) before spending PUs on a render.

```ts
// 1. FREE pre-check: is there a Sentinel-1 pass over this AOI + window?
const scenes = await cop.searchScenes({
  collection: "sentinel-1-grd",
  bbox: [55.9, 24.9, 56.1, 25.1], // [west, south, east, north] WGS84
  time: { from: "2026-06-01T00:00:00Z", to: "2026-06-07T00:00:00Z" },
})
if (scenes.length === 0) return // nothing to detect on — don't spend PUs

// 2. PU-metered: pull a SAR chip around a suspected dark-ship position.
const chip = await cop.sarChip({
  lat: 25.0,
  lon: 56.0,
  radiusKm: 3,
  time: { from: scenes[0].datetime!, to: "2026-06-07T00:00:00Z" },
})
// chip.image     -> Uint8Array (PNG bytes) — feed to a detector or store
// chip.processingUnits -> PU this call billed, for quota tracking
```

For a custom render (bands / evalscript / format), use `getImage()` with one of
the exported evalscripts (`S1_VV_GRAYSCALE`, `S1_VV_VH_FALSE_COLOUR`,
`S2_TRUE_COLOUR`) or your own.

## Notes

- It returns **imagery, not detections** — you (or a SAR ship-detection model)
  still detect vessels in the pixels, then cross-reference bright returns against
  AIS gaps to flag dark ships.
- Keep AOIs small (a few km) and raster size matched to 10 m/px; PU cost grows
  with output pixels.
- Errors are typed: `CopernicusAuthError` (401/403 — bad creds or no access to a
  collection), `CopernicusRateLimitError` (429 — rate limit or quota exhausted),
  `CopernicusTokenError`, `CopernicusTimeoutError`.
