/**
 * Deterministic maritime place resolution for AIS event coordinates.
 *
 * Google reverse-geocoding only names points on or very near land; the dark
 * gaps / STS loiters we care about are usually offshore, where it returns
 * nothing. This module answers "where at sea" the way a mariner would — the
 * nearest port with a bearing & distance, the named sea/ocean, and an
 * approximate coastal-state EEZ — from two small bundled datasets (Natural
 * Earth, public domain). Pure and offline: no API, no key, fully reproducible.
 *
 * Data (prepared at build time, see maritime/data):
 *  - ports.json: [name, country, lat, lon] for ~1,080 world ports.
 *  - seas.json:  simplified named sea/ocean polygons (exterior rings, ~2dp).
 */
import { haversineNm } from "@talasa/shared"
import portsData from "./data/ports.json"
import seasData from "./data/seas.json"

// ---- bundled data shapes ----

type PortRow = [name: string, country: string | null, lat: number, lon: number]
interface SeaFeature {
  n: string // display name
  b: [minLon: number, minLat: number, maxLon: number, maxLat: number]
  p: [lon: number, lat: number][][] // exterior rings
}

const PORTS = portsData as PortRow[]
const SEAS = (seasData as SeaFeature[])
  // Precompute bbox area so we can prefer the most specific (smallest) match.
  .map((s) => ({ ...s, area: (s.b[2] - s.b[0]) * (s.b[3] - s.b[1]) }))

/** A vessel's EEZ typically extends 200 nm from the coastal baseline. */
const EEZ_LIMIT_NM = 200

// ---- output ----

export interface MaritimePlace {
  /** Nearest port as "Port, Country" (or just "Port" if country unknown). */
  nearestPort: string | null
  /** Great-circle distance to that port, nautical miles (rounded). */
  distanceNm: number | null
  /** 8-wind compass bearing FROM the port TO the point ("the point is SW of X"). */
  bearing: string | null
  /** Named sea / ocean the point falls in, else null. */
  sea: string | null
  /** Approximate coastal-state EEZ, or "International waters" beyond 200 nm. */
  eez: string | null
}

// ---- geo helpers ----

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const
const toRad = (deg: number) => (deg * Math.PI) / 180

/** Initial great-circle bearing from A to B as an 8-wind compass point. */
function compassBearing(aLat: number, aLon: number, bLat: number, bLon: number): string {
  const dLon = toRad(bLon - aLon)
  const y = Math.sin(dLon) * Math.cos(toRad(bLat))
  const x =
    Math.cos(toRad(aLat)) * Math.sin(toRad(bLat)) -
    Math.sin(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.cos(dLon)
  const deg = (Math.atan2(y, x) * 180) / Math.PI
  return COMPASS[Math.round(((deg + 360) % 360) / 45) % 8]!
}

/** Ray-casting point-in-polygon over a ring of [lon, lat] vertices. */
function inRing(lat: number, lon: number, ring: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!
    const [xj, yj] = ring[j]!
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

// ---- resolvers ----

function nearestPort(lat: number, lon: number): { name: string; country: string | null; lat: number; lon: number; distanceNm: number } | null {
  let best: PortRow | null = null
  let bestD = Infinity
  for (const p of PORTS) {
    const d = haversineNm(lat, lon, p[2], p[3])
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  if (!best) return null
  return { name: best[0], country: best[1], lat: best[2], lon: best[3], distanceNm: bestD }
}

/** Most specific named sea/ocean containing the point (smallest matching bbox). */
function seaAt(lat: number, lon: number): string | null {
  let name: string | null = null
  let bestArea = Infinity
  for (const s of SEAS) {
    if (lon < s.b[0] || lon > s.b[2] || lat < s.b[1] || lat > s.b[3]) continue
    if (s.area >= bestArea) continue
    if (s.p.some((ring) => inRing(lat, lon, ring))) {
      bestArea = s.area
      name = s.n
    }
  }
  return name
}

/**
 * Resolve a coordinate to a maritime place. Always returns a structured result
 * (fields are null only when genuinely unresolvable). Deterministic — safe to
 * call for every event with no rate limit.
 */
export function resolveMaritime(lat: number, lon: number): MaritimePlace {
  const port = nearestPort(lat, lon)
  const sea = seaAt(lat, lon)
  if (!port) {
    return { nearestPort: null, distanceNm: null, bearing: null, sea, eez: sea ? "International waters" : null }
  }
  const distanceNm = Math.round(port.distanceNm)
  const eez =
    port.country && distanceNm <= EEZ_LIMIT_NM ? `${port.country} EEZ (approx)` : "International waters"
  return {
    nearestPort: port.country ? `${port.name}, ${port.country}` : port.name,
    distanceNm,
    bearing: compassBearing(port.lat, port.lon, lat, lon),
    sea,
    eez,
  }
}
