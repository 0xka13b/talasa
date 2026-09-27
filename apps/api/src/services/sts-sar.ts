import { COLLECTION, S1_SAR_TERRAIN, S1_VV_VH_FALSE_COLOUR, S2_TRUE_COLOUR, bboxAround, verifyStsCandidate } from "@talasa/copernicus"
import type { BBox, SarTarget } from "@talasa/copernicus"
import { and, eq } from "drizzle-orm"
import { db, sarVerifications } from "@talasa/db"
import type { VesselBrief } from "@talasa/shared"
import { lookupVesselDims } from "./datalastic"
import { getCopernicusClient } from "./copernicus"
import { getScreening } from "./screenings"

/** Detection-AOI half-width (km) — wide enough to catch a nearby STS counterparty. */
const DETECT_RADIUS_KM = 5
const DETECT_PX = 512 // detection raster (location match is fine at ~19 m/px)
const DISPLAY_PX = 768 // human-facing annotated chip

/**
 * Palettes the UI can request. `terrain`/`twopol` render the Sentinel-1 SAR
 * pass; `optical` renders the lowest-cloud Sentinel-2 true-colour scene in the
 * window (daylight/cloud-permitting corroboration of the SAR verdict).
 */
export type SarPalette = "terrain" | "twopol" | "optical"
const S1_EVALSCRIPT: Record<"terrain" | "twopol", string> = {
  terrain: S1_SAR_TERRAIN,
  twopol: S1_VV_VH_FALSE_COLOUR,
}

/** Thrown for a bad request (unknown event index, not an STS candidate). */
export class StsSarInputError extends Error {}

/** A geo-located point marked on the returned chip. */
export interface SarMarker {
  lat: number
  lon: number
  lengthM: number
  widthM: number
}

/** The on-demand SAR verification payload returned to the UI. */
export interface StsSarResult {
  available: boolean
  verdict: string | null
  detail: string | null
  scene: { id: string; datetime: string | null } | null
  coverage: number | null
  primary: { distanceM: number; lengthM: number; widthM: number } | null
  contactCount: number
  targetCount: number | null
  vessel: { lengthM: number | null; beamM: number | null }
  /** Base64 chip (PNG), or null when no covered scene was found. */
  image: string | null
  /** Which mission the displayed chip came from. */
  sensor: "sentinel-1" | "sentinel-2" | null
  /** Optical cloud cover % for a Sentinel-2 chip (null for SAR). */
  cloudCover: number | null
  /** The chip's geographic box `[west, south, east, north]`, for pixel mapping. */
  imageBbox: BBox | null
  /** The chip's pixel dimensions. */
  imageSize: { width: number; height: number } | null
  /** The AIS loiter fix (the vessel's reported position) to annotate. */
  aisFix: { lat: number; lon: number } | null
  /** The SAR detection matched to the vessel, to annotate. */
  primaryTarget: SarMarker | null
  /** Additional SAR contacts near the vessel (candidate counterparties). */
  contacts: SarMarker[]
  /** Full PU billed (detection + display), or 0 when served from cache. */
  processingUnits: number | null
  /** True when this result came from the persisted cache (no PU spent). */
  cached: boolean
}

/** Map a cached DB row back to the result shape (jsonb columns are untyped). */
function fromRow(row: typeof sarVerifications.$inferSelect): StsSarResult {
  return {
    available: row.available,
    verdict: row.verdict,
    detail: row.detail,
    scene: row.sceneId ? { id: row.sceneId, datetime: row.sceneDatetime } : null,
    coverage: row.coverage,
    primary: row.primarySummary as StsSarResult["primary"],
    contactCount: row.contactCount,
    targetCount: row.targetCount,
    vessel: { lengthM: row.vesselLengthM, beamM: row.vesselBeamM },
    image: row.image,
    sensor: row.sensor as StsSarResult["sensor"],
    cloudCover: row.cloudCover,
    imageBbox: row.imageBbox as BBox | null,
    imageSize: row.imageSize as StsSarResult["imageSize"],
    aisFix: row.aisFix as StsSarResult["aisFix"],
    primaryTarget: row.primaryTarget as SarMarker | null,
    contacts: (row.contacts as SarMarker[]) ?? [],
    processingUnits: row.processingUnits,
    cached: true,
  }
}

/** Persist a freshly-computed verification (upsert on the cache key). */
async function persist(screeningId: string, eventIdx: number, palette: SarPalette, r: StsSarResult): Promise<void> {
  await db
    .insert(sarVerifications)
    .values({
      screeningId,
      eventIdx,
      palette,
      available: r.available,
      verdict: r.verdict,
      detail: r.detail,
      sceneId: r.scene?.id ?? null,
      sceneDatetime: r.scene?.datetime ?? null,
      coverage: r.coverage,
      sensor: r.sensor,
      cloudCover: r.cloudCover,
      vesselLengthM: r.vessel.lengthM,
      vesselBeamM: r.vessel.beamM,
      targetCount: r.targetCount,
      contactCount: r.contactCount,
      primarySummary: r.primary,
      aisFix: r.aisFix,
      primaryTarget: r.primaryTarget,
      contacts: r.contacts,
      imageBbox: r.imageBbox,
      imageSize: r.imageSize,
      image: r.image,
      processingUnits: r.processingUnits,
    })
    .onConflictDoUpdate({
      target: [sarVerifications.screeningId, sarVerifications.eventIdx, sarVerifications.palette],
      set: { image: r.image, verdict: r.verdict, processingUnits: r.processingUnits, createdAt: new Date() },
    })
}

const toMarker = (t: SarTarget): SarMarker => ({
  lat: t.lat,
  lon: t.lon,
  lengthM: t.lengthM,
  widthM: t.widthM,
})

/** Bound a scene's acquisition to its calendar day for a display render. */
function sceneDayWindow(datetime: string | null, fallback: string): { from: string; to: string } {
  const day = (datetime ?? fallback).slice(0, 10)
  const start = `${day}T00:00:00Z`
  const to = new Date(new Date(start).getTime() + 86_400_000).toISOString().slice(0, 10)
  return { from: start, to: `${to}T00:00:00Z` }
}

/**
 * Verify a screening's Nth AIS event against Sentinel-1 SAR, on demand.
 * Returns null when the screening isn't found/owned; throws {@link
 * StsSarInputError} when the event isn't a locatable STS candidate.
 *
 * PU-metered (this is why it's user-triggered, not run in the pipeline): it
 * fetches a σ0 raster for detection and, when a covered scene exists, a tight
 * annotated display chip centred on the vessel for the UI.
 */
export async function verifyScreeningStsSar(
  userId: string,
  screeningId: string,
  eventIdx: number,
  opts: { palette?: SarPalette; zoomKm?: number } = {},
): Promise<StsSarResult | null> {
  const palette: SarPalette =
    opts.palette === "twopol" || opts.palette === "optical" ? opts.palette : "terrain"
  const zoomKm = Math.min(5, Math.max(0.75, opts.zoomKm ?? 1.5))

  const row = await getScreening(userId, screeningId)
  if (!row) return null

  const brief = row.brief as VesselBrief | null
  const event = brief?.ais?.events?.[eventIdx]
  if (!event) throw new StsSarInputError("No such AIS event")
  if (event.kind !== "sts_candidate" || event.lat == null || event.lon == null) {
    throw new StsSarInputError("Event is not a locatable STS candidate")
  }
  if (!event.startUtc || !event.endUtc) {
    throw new StsSarInputError("STS candidate has no time window")
  }

  // Cache-first: a prior verification of this (screening, event, palette) is
  // durable evidence and costs 0 PU to re-serve.
  const [hit] = await db
    .select()
    .from(sarVerifications)
    .where(
      and(
        eq(sarVerifications.screeningId, screeningId),
        eq(sarVerifications.eventIdx, eventIdx),
        eq(sarVerifications.palette, palette),
      ),
    )
  if (hit) return fromRow(hit)

  const dims = await lookupVesselDims(row.imo)
  const cop = getCopernicusClient()

  const verification = await verifyStsCandidate(cop, {
    lat: event.lat,
    lon: event.lon,
    from: event.startUtc,
    to: event.endUtc,
    vesselLengthM: dims.lengthM,
    vesselBeamM: dims.beamM,
    aoiRadiusKm: DETECT_RADIUS_KM,
    rasterPx: DETECT_PX,
  })

  const match = verification.correlation?.primaryMatch ?? null
  const primary = match
    ? {
        distanceM: Math.round(verification.correlation?.matchDistanceM ?? 0),
        lengthM: Math.round(match.lengthM),
        widthM: Math.round(match.widthM),
      }
    : null

  // Render a tight, annotated chip centred on the detected hull (else the AIS
  // fix). SAR palettes need an S1 pass that covered the fix; the optical palette
  // instead pulls the lowest-cloud Sentinel-2 scene in the loiter window.
  const centerLat = match?.lat ?? event.lat
  const centerLon = match?.lon ?? event.lon
  const imageBbox: BBox = bboxAround(centerLat, centerLon, zoomKm)
  const imageSize = { width: DISPLAY_PX, height: DISPLAY_PX }
  let image: string | null = null
  let sensor: "sentinel-1" | "sentinel-2" | null = null
  let cloudCover: number | null = null
  let displayPu = 0

  if (palette === "optical") {
    // Lowest-cloud Sentinel-2 true-colour scene over the loiter window.
    const scenes = await cop.searchScenes({
      collection: COLLECTION.sentinel2L2a,
      bbox: imageBbox,
      time: { from: event.startUtc, to: event.endUtc },
    })
    const best = scenes
      .slice()
      .sort((a, b) => (a.cloudCover ?? 100) - (b.cloudCover ?? 100))[0]
    if (best) {
      const chip = await cop.getImage({
        collection: COLLECTION.sentinel2L2a,
        bbox: imageBbox,
        time: sceneDayWindow(best.datetime, event.startUtc),
        evalscript: S2_TRUE_COLOUR,
        width: DISPLAY_PX,
        height: DISPLAY_PX,
        format: "image/png",
      })
      image = Buffer.from(chip.image).toString("base64")
      sensor = "sentinel-2"
      cloudCover = best.cloudCover
      displayPu = chip.processingUnits ?? 0
    }
  } else if (verification.available && verification.verdict !== null && verification.scene) {
    const chip = await cop.getImage({
      collection: COLLECTION.sentinel1Grd,
      bbox: imageBbox,
      time: sceneDayWindow(verification.scene.datetime, event.startUtc),
      evalscript: S1_EVALSCRIPT[palette],
      width: DISPLAY_PX,
      height: DISPLAY_PX,
      format: "image/png",
    })
    image = Buffer.from(chip.image).toString("base64")
    sensor = "sentinel-1"
    displayPu = chip.processingUnits ?? 0
  }

  const result: StsSarResult = {
    available: verification.available,
    verdict: verification.verdict,
    detail: verification.correlation?.detail ?? null,
    scene: verification.scene,
    coverage: verification.coverage,
    primary,
    contactCount: verification.correlation?.nearbyContacts.length ?? 0,
    targetCount: verification.targetCount,
    vessel: { lengthM: dims.lengthM, beamM: dims.beamM },
    image,
    sensor,
    cloudCover,
    imageBbox: image ? imageBbox : null,
    imageSize: image ? imageSize : null,
    aisFix: { lat: event.lat, lon: event.lon },
    primaryTarget: match ? toMarker(match) : null,
    contacts: (verification.correlation?.nearbyContacts ?? []).map(toMarker),
    // Full cost: the detection raster(s) + the display chip.
    processingUnits: verification.processingUnits + displayPu,
    cached: false,
  }
  await persist(screeningId, eventIdx, palette, result)
  return result
}
