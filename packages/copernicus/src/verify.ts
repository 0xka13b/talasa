import { CopernicusClient, bboxAround } from "./client"
import { COLLECTION } from "./constants"
import { correlateStsCandidate } from "./correlate"
import type { StsCorrelation, StsVerdict } from "./correlate"
import type { CatalogScene } from "./types"

/** Inputs to verify one AIS STS candidate against Sentinel-1 SAR. */
export interface StsVerificationRequest {
  /** Loiter-fix latitude. */
  lat: number
  /** Loiter-fix longitude. */
  lon: number
  /** Loiter window start (ISO-8601) — the STS candidate's `startUtc`. */
  from: string
  /** Loiter window end (ISO-8601) — the STS candidate's `endUtc`. */
  to: string
  /** Registered length overall, metres (from vessel_info), if known. */
  vesselLengthM?: number | null
  /** Registered beam, metres, if known. */
  vesselBeamM?: number | null
  /** AOI half-width around the fix, km. Default 5. */
  aoiRadiusKm?: number
  /** σ0 raster edge in pixels. Default 1024 (~10 m/px over a 5 km AOI). */
  rasterPx?: number
}

/** The full outcome of a SAR verification attempt. */
export interface StsVerification {
  /** True if a contemporaneous (in-window) Sentinel-1 scene existed. */
  available: boolean
  /** The scene used (or the newest in-window one when none covered the fix). */
  scene: { id: string; datetime: string | null } | null
  /** Fraction of the AOI actually imaged by the chosen scene (null if none usable). */
  coverage: number | null
  /** The graded STS verdict, or null if no usable pass covered the fix. */
  verdict: StsVerdict | null
  /** Full correlation detail (primary match, contacts), or null. */
  correlation: StsCorrelation | null
  /** Number of SAR targets detected in the AOI, or null. */
  targetCount: number | null
  /** Processing units the detection fetch(es) billed (STAC search is free). */
  processingUnits: number
}

/** Add whole days to an ISO instant and return the date portion `YYYY-MM-DD`. */
function shiftDate(iso: string, days: number): string {
  const t = new Date(iso).getTime() + days * 86_400_000
  return new Date(t).toISOString().slice(0, 10)
}

/** Bound a scene's acquisition to its single calendar day for a Process request. */
function sceneDayWindow(scene: CatalogScene, fallbackFrom: string): { from: string; to: string } {
  const day = (scene.datetime ?? fallbackFrom).slice(0, 10)
  return { from: `${day}T00:00:00Z`, to: `${shiftDate(`${day}T00:00:00Z`, 1)}T00:00:00Z` }
}

/**
 * Verify one AIS STS candidate end-to-end: free STAC search over the loiter
 * window, then — newest scene first — detect vessels in the σ0 raster and
 * correlate against the loiter fix, skipping any pass whose swath edge left the
 * AOI in no-data. PU-metered (the detection fetches), so call this on demand,
 * not eagerly for every screening.
 *
 * The free availability check alone (a scene exists in-window) is safe to run
 * eagerly; use {@link CopernicusClient.searchScenes} directly for that.
 */
export async function verifyStsCandidate(
  client: CopernicusClient,
  req: StsVerificationRequest,
): Promise<StsVerification> {
  const bbox = bboxAround(req.lat, req.lon, req.aoiRadiusKm ?? 5)
  const px = req.rasterPx ?? 1024

  const scenes = await client.searchScenes({
    collection: COLLECTION.sentinel1Grd,
    bbox,
    time: { from: req.from, to: req.to },
  })
  if (scenes.length === 0) {
    return { available: false, scene: null, coverage: null, verdict: null, correlation: null, targetCount: null, processingUnits: 0 }
  }

  // Try scenes newest-first until one actually covers the fix (swath edges can
  // leave a "matching" scene as no-data over the AOI centre). Every attempt bills
  // its detection raster, so accumulate the PU across retries.
  let processingUnits = 0
  for (const scene of scenes.slice(0, 4)) {
    const window = sceneDayWindow(scene, req.from)
    const det = await client.detectVessels({ bbox, time: window, width: px, height: px })
    processingUnits += det.processingUnits ?? 0
    if (det.coverage < 0.5) continue
    const correlation = correlateStsCandidate(det.targets, {
      lat: req.lat,
      lon: req.lon,
      vesselLengthM: req.vesselLengthM,
      vesselBeamM: req.vesselBeamM,
    })
    return {
      available: true,
      scene: { id: scene.id, datetime: scene.datetime },
      coverage: det.coverage,
      verdict: correlation.verdict,
      correlation,
      targetCount: det.targets.length,
      processingUnits,
    }
  }

  // Scenes existed in-window but none covered the loiter fix.
  const newest = scenes[0]
  return {
    available: true,
    scene: newest ? { id: newest.id, datetime: newest.datetime } : null,
    coverage: 0,
    verdict: null,
    correlation: null,
    targetCount: null,
    processingUnits,
  }
}
