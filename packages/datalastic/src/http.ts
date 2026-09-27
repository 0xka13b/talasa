import {
  DatalasticAuthError,
  DatalasticConfigError,
  DatalasticHttpError,
  DatalasticRateLimitError,
  DatalasticTimeoutError,
} from "./errors"
import {
  inRadiusResponseSchema,
  vesselHistoryResponseSchema,
  vesselInfoResponseSchema,
  vesselLiveResponseSchema,
} from "./types"
import type {
  RawInRadius,
  RawVesselHistory,
  RawVesselInfo,
  RawVesselLive,
  VesselSelector,
} from "./types"

export interface TransportConfig {
  baseUrl: string
  apiKey: string
  timeoutMs: number
}

/** History window: a trailing `days` count, or an explicit `from`/`to` (YYYY-MM-DD). */
export interface HistoryWindow {
  days?: number
  from?: string
  to?: string
}

/** A `/vessel_inradius` query (radius in nautical miles), with optional type filters. */
export interface RadiusQuery {
  lat: number
  lon: number
  radius: number
  type?: string
  typeSpecific?: string
}

type QueryValue = string | number | undefined

/** Build a fully-qualified URL, always attaching the `api-key` and dropping empty params. */
function buildUrl(config: TransportConfig, path: string, params: Record<string, QueryValue>): string {
  const url = new URL(`${config.baseUrl}${path}`)
  url.searchParams.set("api-key", config.apiKey)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

/** Turn a vessel selector into query params, enforcing exactly one identifier. */
export function selectorParams(selector: VesselSelector): Record<string, string> {
  const keys = ["uuid", "imo", "mmsi"] as const
  const record = selector as Partial<Record<(typeof keys)[number], string>>
  const present = keys.filter((k) => record[k] != null && String(record[k]).trim() !== "")
  const [key] = present
  if (present.length !== 1 || key === undefined) {
    throw new DatalasticConfigError(
      `vessel selector must have exactly one of uuid/imo/mmsi (got ${present.length})`,
    )
  }
  return { [key]: String(record[key]).trim() }
}

async function doFetch(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } })
  } catch (err) {
    if (controller.signal.aborted) {
      throw new DatalasticTimeoutError(url, timeoutMs)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

async function toHttpError(res: Response): Promise<DatalasticHttpError> {
  const body = await safeBody(res)
  if (res.status === 401 || res.status === 403) {
    return new DatalasticAuthError(res.status, body)
  }
  if (res.status === 429) {
    return new DatalasticRateLimitError(res.status, body)
  }
  return new DatalasticHttpError(res.status, body)
}

async function safeBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300)
  } catch {
    return ""
  }
}

/** GET + status handling shared by every endpoint. 404 -> null (no such record). */
async function getJson(config: TransportConfig, url: string): Promise<unknown | null> {
  const res = await doFetch(url, config.timeoutMs)
  if (res.status === 404) {
    return null
  }
  if (!res.ok) {
    throw await toHttpError(res)
  }
  return res.json()
}

/** `/vessel` (basic) or `/vessel_pro` (adds draught/ETA). 1 credit. Unknown vessel -> null. */
export async function fetchVessel(
  config: TransportConfig,
  selector: VesselSelector,
  pro: boolean,
): Promise<RawVesselLive | null> {
  const url = buildUrl(config, pro ? "/vessel_pro" : "/vessel", selectorParams(selector))
  const json = await getJson(config, url)
  return json === null ? null : vesselLiveResponseSchema.parse(json).data
}

/** `/vessel_info` — static specifications. 1 credit. Unknown vessel -> null. */
export async function fetchVesselInfo(
  config: TransportConfig,
  selector: VesselSelector,
): Promise<RawVesselInfo | null> {
  const url = buildUrl(config, "/vessel_info", selectorParams(selector))
  const json = await getJson(config, url)
  return json === null ? null : vesselInfoResponseSchema.parse(json).data
}

/** `/vessel_history` — the AIS track. Credits = days × 1 vessel. Unknown vessel -> null. */
export async function fetchVesselHistory(
  config: TransportConfig,
  selector: VesselSelector,
  window: HistoryWindow,
): Promise<RawVesselHistory | null> {
  const url = buildUrl(config, "/vessel_history", {
    ...selectorParams(selector),
    days: window.days,
    from: window.from,
    to: window.to,
  })
  const json = await getJson(config, url)
  return json === null ? null : vesselHistoryResponseSchema.parse(json).data
}

/** `/vessel_inradius` — live area scan. Credits = 1 per vessel returned (max 500). */
export async function fetchVesselsInRadius(
  config: TransportConfig,
  query: RadiusQuery,
): Promise<RawInRadius | null> {
  const url = buildUrl(config, "/vessel_inradius", {
    lat: query.lat,
    lon: query.lon,
    radius: query.radius,
    type: query.type,
    type_specific: query.typeSpecific,
  })
  const json = await getJson(config, url)
  return json === null ? null : inRadiusResponseSchema.parse(json).data
}
