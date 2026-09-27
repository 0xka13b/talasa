import type { SarTarget } from "./detect"

/**
 * The AIS-derived site of an STS candidate: where the vessel loitered, and its
 * known dimensions (from the ship register / AIS static data). Because a
 * loitering vessel is ~stationary, the loiter fix IS its expected position at
 * the satellite pass — no track interpolation needed.
 */
export interface StsCandidateSite {
  /** Loiter-fix latitude (the vessel's AIS position during the STS window). */
  lat: number
  /** Loiter-fix longitude. */
  lon: number
  /** Registered length overall, metres (for size-plausibility), if known. */
  vesselLengthM?: number | null
  /** Registered beam, metres (for the beam-doubling STS test), if known. */
  vesselBeamM?: number | null
}

export interface CorrelateOptions {
  /** A detection within this of the loiter fix is taken to be the vessel. Default 500 m. */
  matchGateM?: number
  /** A second detection within this of the primary is an STS contact. Default 300 m. */
  stsRangeM?: number
  /** Matched width above `beamRatio × registered beam` flags a possible side-by-side. Default 1.6. */
  beamRatio?: number
}

/**
 * The correlation outcome, from strongest STS evidence to none:
 *  - `sts_contact` — a second physical hull sits alongside the loitering vessel.
 *  - `beam_anomaly` — one blob, but far wider than the vessel's beam (possible
 *    side-by-side unresolved at ~10 m, or SAR smear — a weak signal).
 *  - `vessel_confirmed` — the vessel is physically present at the loiter fix,
 *    single hull. Corroborates the AIS loiter; no second contact seen.
 *  - `no_detection` — nothing at the loiter fix. If the pass covered the AOI
 *    (check {@link DetectResult.coverage} upstream), the AIS position is
 *    physically unsupported — a possible spoof, or the vessel had moved.
 */
export type StsVerdict = "sts_contact" | "beam_anomaly" | "vessel_confirmed" | "no_detection"

export interface StsCorrelation {
  verdict: StsVerdict
  /** The detection taken to be the loitering vessel (nearest within the gate), or null. */
  primaryMatch: SarTarget | null
  /** Distance from the loiter fix to {@link primaryMatch}, metres. */
  matchDistanceM: number | null
  /** Other detections within `stsRangeM` of the primary — candidate counterparties. */
  nearbyContacts: SarTarget[]
  /** Human-readable one-liner for the evidence trail. */
  detail: string
}

const R_EARTH_M = 6_371_000

/** Great-circle distance between two lat/lon points, in metres. */
export function haversineM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const d = Math.PI / 180
  const s =
    Math.sin(((bLat - aLat) * d) / 2) ** 2 +
    Math.cos(aLat * d) * Math.cos(bLat * d) * Math.sin(((bLon - aLon) * d) / 2) ** 2
  return 2 * R_EARTH_M * Math.asin(Math.sqrt(s))
}

/**
 * Correlate SAR detections against an AIS STS candidate, producing a verdict.
 *
 * Pure and deterministic. The strongest signal for shadow-fleet STS is a
 * *second* physical hull next to the loitering vessel that AIS doesn't account
 * for — this returns that as `sts_contact` with the contact(s) attached. Note
 * this confirms a second hull was *present*; whether the counterparty was truly
 * "dark" (no AIS anywhere) requires the multi-vessel AIS check the caller layers
 * on top — here we only know it isn't the primary vessel.
 */
export function correlateStsCandidate(
  detections: SarTarget[],
  site: StsCandidateSite,
  options: CorrelateOptions = {},
): StsCorrelation {
  const matchGateM = options.matchGateM ?? 500
  const stsRangeM = options.stsRangeM ?? 300
  const beamRatio = options.beamRatio ?? 1.6

  const withDist = detections.map((t) => ({ t, dist: haversineM(site.lat, site.lon, t.lat, t.lon) }))
  withDist.sort((a, b) => a.dist - b.dist)

  const primary = withDist[0]
  if (!primary || primary.dist > matchGateM) {
    return {
      verdict: "no_detection",
      primaryMatch: null,
      matchDistanceM: primary?.dist ?? null,
      nearbyContacts: [],
      detail:
        `No SAR contact within ${matchGateM} m of the AIS loiter fix` +
        (primary ? ` (nearest ${Math.round(primary.dist)} m away)` : "") +
        ". If the pass covered the AOI, the AIS position is physically unsupported.",
    }
  }

  const nearbyContacts = withDist
    .slice(1)
    .filter((d) => haversineM(primary.t.lat, primary.t.lon, d.t.lat, d.t.lon) <= stsRangeM)
    .map((d) => d.t)

  if (nearbyContacts.length > 0) {
    return {
      verdict: "sts_contact",
      primaryMatch: primary.t,
      matchDistanceM: primary.dist,
      nearbyContacts,
      detail:
        `Vessel present at the loiter fix (${Math.round(primary.dist)} m) with ` +
        `${nearbyContacts.length} additional SAR contact(s) within ${stsRangeM} m — a second hull alongside.`,
    }
  }

  if (site.vesselBeamM && primary.t.widthM > beamRatio * site.vesselBeamM) {
    return {
      verdict: "beam_anomaly",
      primaryMatch: primary.t,
      matchDistanceM: primary.dist,
      nearbyContacts: [],
      detail:
        `Single SAR contact at the loiter fix (${Math.round(primary.dist)} m) but ~${Math.round(primary.t.widthM)} m wide ` +
        `vs a ${Math.round(site.vesselBeamM)} m registered beam — possible side-by-side unresolved at SAR scale (weak).`,
    }
  }

  return {
    verdict: "vessel_confirmed",
    primaryMatch: primary.t,
    matchDistanceM: primary.dist,
    nearbyContacts: [],
    detail: `Vessel physically present at the AIS loiter fix (${Math.round(primary.dist)} m), single hull. Corroborates the loiter.`,
  }
}
