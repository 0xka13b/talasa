/**
 * Deterministic AIS behaviour detectors.
 *
 * These are pure functions over a vessel's position track (from Datalastic
 * `/vessel_history`). They turn raw fixes into the STRUCTURED EVENTS a compliance
 * analyst — or the LLM narrative layer — reasons about: transmission gaps
 * ("dark" activity), loitering / ship-to-ship (STS) candidates, and implausible
 * speed jumps (position spoofing). No I/O, no LLM: the numbers are reproducible
 * from the stored track, which is what makes the downstream verdict auditable.
 *
 * Honest scope: with a single vessel's terrestrial track we can flag a loiter as
 * an STS *candidate*, never confirm a transfer (that needs the counterparty's
 * track, offshore coverage, and often spans a deliberate dark period). Callers
 * must label these "suspected", not "confirmed".
 */

// ---- input ----

/** The minimal fields a detector needs from one AIS fix. */
export interface AisFix {
  lat: number | null
  lon: number | null
  /** Speed over ground, knots. */
  speed: number | null
  /** Unix seconds. */
  epoch: number | null
  timeUtc: string | null
  navStatus: string | null
}

// ---- detector outputs ----

export interface DarkGap {
  fromEpoch: number
  toEpoch: number
  fromUtc: string | null
  toUtc: string | null
  durationHours: number
  fromLat: number
  fromLon: number
  toLat: number
  toLon: number
  /** Straight-line distance between the last fix before and first fix after the gap. */
  distanceNm: number
  /** distanceNm / durationHours — a low value means it could have diverted unseen. */
  impliedSpeedKn: number
  /** Name of a known high-risk STS zone the gap started or ended in, else null. */
  highRiskArea: string | null
}

export interface LoiterEvent {
  fromEpoch: number
  toEpoch: number
  fromUtc: string | null
  toUtc: string | null
  durationHours: number
  lat: number
  lon: number
  /** Not moored/anchored → a mid-voyage stop, i.e. a ship-to-ship candidate. */
  stsCandidate: boolean
  highRiskArea: string | null
}

export interface SpeedAnomaly {
  fromEpoch: number
  toEpoch: number
  fromUtc: string | null
  toUtc: string | null
  distanceNm: number
  /** Implied speed exceeds any plausible vessel speed → likely spoofed position. */
  impliedSpeedKn: number
}

export interface AisBehavior {
  /** True when a track with ≥1 usable fix was analysed (false = no data / no provider). */
  available: boolean
  positionCount: number
  spanDays: number
  firstEpoch: number | null
  lastEpoch: number | null
  darkGaps: DarkGap[]
  loiters: LoiterEvent[]
  speedAnomalies: SpeedAnomaly[]
}

// ---- thresholds (coarse, tunable v1 defaults) ----

export interface AisThresholds {
  /** A transmission gap ≥ this many hours is a dark event. */
  darkGapHours: number
  /** Speed at/below this (knots) counts as stopped. */
  loiterMaxSpeedKn: number
  /** A stop must last at least this many hours to be a loiter. */
  loiterMinHours: number
  /** Implied speed above this (knots) between two fixes is physically implausible. */
  maxPlausibleSpeedKn: number
}

export const DEFAULT_AIS_THRESHOLDS: AisThresholds = {
  darkGapHours: 6,
  loiterMaxSpeedKn: 0.7,
  loiterMinHours: 3,
  maxPlausibleSpeedKn: 30,
}

// ---- high-risk STS zones (coarse bounding boxes; deliberately conservative) ----

interface Zone {
  name: string
  minLat: number
  maxLat: number
  minLon: number
  maxLon: number
}

/**
 * Rough boxes around jurisdictions/anchorages repeatedly tied to shadow-fleet STS.
 * Coarse by design — a weak corroborating signal, not a geofence. Tunable.
 */
export const HIGH_RISK_STS_ZONES: readonly Zone[] = [
  { name: "Novorossiysk (Black Sea)", minLat: 44.0, maxLat: 45.2, minLon: 36.4, maxLon: 38.6 },
  { name: "Kerch Strait", minLat: 44.9, maxLat: 45.5, minLon: 36.2, maxLon: 36.9 },
  { name: "Gulf of Finland (Baltic)", minLat: 59.3, maxLat: 60.8, minLon: 27.4, maxLon: 29.6 },
  { name: "Laconian Gulf (Greece)", minLat: 36.0, maxLat: 37.0, minLon: 21.6, maxLon: 23.2 },
  { name: "Fujairah OPL", minLat: 24.8, maxLat: 25.7, minLon: 56.3, maxLon: 57.4 },
  { name: "Singapore Strait / Malaysia", minLat: 0.9, maxLat: 2.1, minLon: 103.4, maxLon: 105.6 },
  { name: "Nakhodka (RU Far East)", minLat: 42.4, maxLat: 43.3, minLon: 132.4, maxLon: 133.6 },
  { name: "Off Venezuela", minLat: 10.0, maxLat: 12.6, minLon: -68.6, maxLon: -62.9 },
  { name: "Strait of Gibraltar", minLat: 35.7, maxLat: 36.3, minLon: -5.7, maxLon: -5.0 },
]

/** Name of the first high-risk zone containing the point, else null. */
export function highRiskZoneAt(lat: number | null, lon: number | null): string | null {
  if (lat == null || lon == null) return null
  for (const z of HIGH_RISK_STS_ZONES) {
    if (lat >= z.minLat && lat <= z.maxLat && lon >= z.minLon && lon <= z.maxLon) return z.name
  }
  return null
}

/**
 * Ship types for which a mid-voyage stop is routine, not a ship-to-ship signal:
 * yachts and pleasure craft anchor for leisure, and fishing vessels stop on the
 * grounds to work. Flagging their loiters as STS candidates is pure false-positive
 * noise. Matched against the free-text Equasis "type of ship" string (and
 * Datalastic `typeSpecific`), so the terms are kept broad.
 */
const STS_IMPLAUSIBLE_TYPE = /yacht|pleasure|sailing|fishing|trawler|seiner|troller/i

/** True when the vessel's type makes a loiter ordinary behaviour, not an STS candidate. */
export function isStsImplausibleVesselType(type: string | null | undefined): boolean {
  return type != null && STS_IMPLAUSIBLE_TYPE.test(type)
}

// ---- geo ----

const EARTH_RADIUS_NM = 3440.065
const toRad = (deg: number) => (deg * Math.PI) / 180

/** Great-circle distance between two lat/lon points, in nautical miles. */
export function haversineNm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = toRad(bLat - aLat)
  const dLon = toRad(bLon - aLon)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(s)))
}

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp

const MOORED_OR_ANCHORED = /moor|anchor/i

// ---- usable fix (all detector-relevant fields present) ----

interface Fix {
  lat: number
  lon: number
  speed: number | null
  epoch: number
  utc: string | null
  navStatus: string | null
}

function usableFixes(fixes: AisFix[]): Fix[] {
  const out: Fix[] = []
  for (const f of fixes) {
    if (f.lat == null || f.lon == null || f.epoch == null) continue
    out.push({ lat: f.lat, lon: f.lon, speed: f.speed, epoch: f.epoch, utc: f.timeUtc, navStatus: f.navStatus })
  }
  // Chronological; dedupe identical timestamps (Datalastic can repeat a fix).
  out.sort((a, b) => a.epoch - b.epoch)
  return out.filter((f, i) => i === 0 || f.epoch !== out[i - 1]!.epoch)
}

// ---- detectors ----

/** Consecutive fixes separated by ≥ darkGapHours of silence. */
export function detectDarkGaps(fixes: AisFix[], t: AisThresholds = DEFAULT_AIS_THRESHOLDS): DarkGap[] {
  const f = usableFixes(fixes)
  const gaps: DarkGap[] = []
  for (let i = 1; i < f.length; i++) {
    const a = f[i - 1]!
    const b = f[i]!
    const hours = (b.epoch - a.epoch) / 3600
    if (hours < t.darkGapHours) continue
    const distanceNm = haversineNm(a.lat, a.lon, b.lat, b.lon)
    gaps.push({
      fromEpoch: a.epoch,
      toEpoch: b.epoch,
      fromUtc: a.utc,
      toUtc: b.utc,
      durationHours: round(hours),
      fromLat: a.lat,
      fromLon: a.lon,
      toLat: b.lat,
      toLon: b.lon,
      distanceNm: round(distanceNm),
      impliedSpeedKn: round(distanceNm / hours),
      highRiskArea: highRiskZoneAt(a.lat, a.lon) ?? highRiskZoneAt(b.lat, b.lon),
    })
  }
  return gaps
}

/** Runs of consecutive stopped fixes lasting ≥ loiterMinHours. */
export function detectLoiters(fixes: AisFix[], t: AisThresholds = DEFAULT_AIS_THRESHOLDS): LoiterEvent[] {
  const f = usableFixes(fixes)
  const loiters: LoiterEvent[] = []
  let start = -1
  const flush = (endIdx: number) => {
    if (start < 0) return
    const a = f[start]!
    const b = f[endIdx]!
    const hours = (b.epoch - a.epoch) / 3600
    if (hours >= t.loiterMinHours) {
      // Centroid of the stopped run.
      let sumLat = 0
      let sumLon = 0
      let anchored = false
      for (let k = start; k <= endIdx; k++) {
        sumLat += f[k]!.lat
        sumLon += f[k]!.lon
        if (f[k]!.navStatus && MOORED_OR_ANCHORED.test(f[k]!.navStatus!)) anchored = true
      }
      const n = endIdx - start + 1
      const lat = sumLat / n
      const lon = sumLon / n
      loiters.push({
        fromEpoch: a.epoch,
        toEpoch: b.epoch,
        fromUtc: a.utc,
        toUtc: b.utc,
        durationHours: round(hours),
        lat: round(lat, 4),
        lon: round(lon, 4),
        // Moored/anchored → a port or anchorage stop, not an STS candidate.
        stsCandidate: !anchored,
        highRiskArea: highRiskZoneAt(lat, lon),
      })
    }
    start = -1
  }
  for (let i = 0; i < f.length; i++) {
    const stopped = f[i]!.speed != null && f[i]!.speed! <= t.loiterMaxSpeedKn
    if (stopped) {
      if (start < 0) start = i
    } else if (start >= 0) {
      flush(i - 1)
    }
  }
  if (start >= 0) flush(f.length - 1)
  return loiters
}

/** Consecutive fixes whose implied speed exceeds any plausible vessel speed. */
export function detectSpeedAnomalies(
  fixes: AisFix[],
  t: AisThresholds = DEFAULT_AIS_THRESHOLDS,
): SpeedAnomaly[] {
  const f = usableFixes(fixes)
  const out: SpeedAnomaly[] = []
  for (let i = 1; i < f.length; i++) {
    const a = f[i - 1]!
    const b = f[i]!
    const hours = (b.epoch - a.epoch) / 3600
    if (hours <= 0) continue
    const distanceNm = haversineNm(a.lat, a.lon, b.lat, b.lon)
    const implied = distanceNm / hours
    if (implied > t.maxPlausibleSpeedKn) {
      out.push({
        fromEpoch: a.epoch,
        toEpoch: b.epoch,
        fromUtc: a.utc,
        toUtc: b.utc,
        distanceNm: round(distanceNm),
        impliedSpeedKn: round(implied),
      })
    }
  }
  return out
}

/** Run every detector over a track and summarise coverage. */
export function analyzeTrack(fixes: AisFix[], t: AisThresholds = DEFAULT_AIS_THRESHOLDS): AisBehavior {
  const f = usableFixes(fixes)
  const first = f[0]?.epoch ?? null
  const last = f[f.length - 1]?.epoch ?? null
  return {
    available: f.length > 0,
    positionCount: f.length,
    spanDays: first != null && last != null ? round((last - first) / 86400, 1) : 0,
    firstEpoch: first,
    lastEpoch: last,
    darkGaps: detectDarkGaps(fixes, t),
    loiters: detectLoiters(fixes, t),
    speedAnomalies: detectSpeedAnomalies(fixes, t),
  }
}

/** A "no data" behaviour result. `available=false` marks the AIS gap for the verdict. */
export function emptyAisBehavior(available = false): AisBehavior {
  return {
    available,
    positionCount: 0,
    spanDays: 0,
    firstEpoch: null,
    lastEpoch: null,
    darkGaps: [],
    loiters: [],
    speedAnomalies: [],
  }
}

// ---- verdict inputs derived from a behaviour result ----

export interface AisScoreInputs {
  darkGapCount: number
  darkGapInHighRiskZone: boolean
  stsCandidateCount: number
  speedAnomalyCount: number
}

/** Reduce a behaviour result to the booleans/counts the verdict weighs. */
export function aisScoreInputs(b: AisBehavior): AisScoreInputs {
  const stsCandidates = b.loiters.filter((l) => l.stsCandidate)
  return {
    darkGapCount: b.darkGaps.length,
    darkGapInHighRiskZone:
      b.darkGaps.some((g) => g.highRiskArea != null) ||
      stsCandidates.some((l) => l.highRiskArea != null),
    stsCandidateCount: stsCandidates.length,
    speedAnomalyCount: b.speedAnomalies.length,
  }
}
