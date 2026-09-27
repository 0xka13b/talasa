/**
 * Reverse-geocoding via the Google Geocoding API. Turns an AIS event's lat/lon
 * into a human place label ("Freetown, Sierra Leone") for the report map and PDF.
 *
 * Deliberately best-effort: every failure mode — no key, HTTP error, timeout,
 * ZERO_RESULTS (open ocean), malformed body — resolves to `null`, never throws.
 * A missing place label must not fail a screening; the map still renders the
 * point, just without a name.
 */

// ---- response shape (only the fields we read) ----

interface GeocodeComponent {
  long_name: string
  short_name: string
  types: string[]
}
interface GeocodeResult {
  address_components: GeocodeComponent[]
  formatted_address: string
}
interface GeocodeResponse {
  status: string
  results: GeocodeResult[]
}

// Locality-level types, most specific first. The first one present wins.
const LOCALITY_TYPES = [
  "locality",
  "postal_town",
  "natural_feature",
  "administrative_area_level_2",
  "administrative_area_level_1",
] as const

/** First component across all results whose `types` include `type`. */
function firstNamed(results: GeocodeResult[], type: string): string | null {
  for (const r of results) {
    for (const c of r.address_components) {
      if (c.types.includes(type)) return c.long_name
    }
  }
  return null
}

/**
 * Reduce a Geocoding response to a concise "Place, Country" label. Exported for
 * unit testing — pure, no I/O.
 */
export function pickPlaceLabel(res: GeocodeResponse): string | null {
  if (res.status !== "OK" || res.results.length === 0) return null
  const country = firstNamed(res.results, "country")
  let locality: string | null = null
  for (const t of LOCALITY_TYPES) {
    locality = firstNamed(res.results, t)
    if (locality) break
  }
  if (locality && country && locality !== country) return `${locality}, ${country}`
  return locality ?? country ?? null
}

// ---- client ----

export interface GeocodeClientConfig {
  apiKey: string
  baseUrl: string
  minRequestIntervalMs: number
  timeoutMs?: number
}

export class GeocodeClient {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly minIntervalMs: number
  private readonly timeoutMs: number
  // Serialize calls and space them out to stay under the QPS limit.
  private queue: Promise<unknown> = Promise.resolve()
  private lastStartAt = Number.NEGATIVE_INFINITY
  // Within one screening, nearby events resolve to the same label — cache by
  // coordinates rounded to ~1km so we don't pay for duplicate lookups.
  private readonly cache = new Map<string, string | null>()

  constructor(config: GeocodeClientConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl
    this.minIntervalMs = config.minRequestIntervalMs
    this.timeoutMs = config.timeoutMs ?? 8000
  }

  /** Reverse-geocode a point to a place label, or `null` if it can't be resolved. */
  async reverseGeocode(lat: number, lon: number): Promise<string | null> {
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`
    if (this.cache.has(key)) return this.cache.get(key) ?? null
    const label = await this.throttle(() => this.fetchLabel(lat, lon))
    this.cache.set(key, label)
    return label
  }

  private async fetchLabel(lat: number, lon: number): Promise<string | null> {
    const url = new URL(this.baseUrl)
    url.searchParams.set("latlng", `${lat},${lon}`)
    url.searchParams.set("key", this.apiKey)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const resp = await fetch(url.toString(), { signal: controller.signal, headers: { Accept: "application/json" } })
      if (!resp.ok) return null
      const body = (await resp.json()) as GeocodeResponse
      return pickPlaceLabel(body)
    } catch {
      // Best-effort: swallow network/timeout/parse errors.
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  private throttle<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.queue.then(async () => {
      const wait = this.minIntervalMs - (Date.now() - this.lastStartAt)
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
      this.lastStartAt = Date.now()
      return fn()
    })
    this.queue = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }
}
