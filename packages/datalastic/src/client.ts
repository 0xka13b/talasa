import { DEFAULT_BASE_URL, DEFAULT_HISTORY_DAYS, DEFAULT_MIN_REQUEST_INTERVAL_MS, DEFAULT_TIMEOUT_MS } from "./constants"
import { DatalasticConfigError } from "./errors"
import {
  fetchVessel,
  fetchVesselHistory,
  fetchVesselInfo,
  fetchVesselsInRadius,
} from "./http"
import type { HistoryWindow, TransportConfig } from "./http"
import { mapRadiusScan, mapVesselInfo, mapVesselLive, mapVesselTrack } from "./map"
import { Throttle } from "./throttle"
import type { RadiusScan, VesselLive, VesselSelector, VesselSpecs, VesselTrack } from "./types"

export interface DatalasticClientConfig {
  /** Required. Datalastic issues one key per plan; passed as the `api-key` query param. */
  apiKey: string
  baseUrl?: string
  timeoutMs?: number
  /** Minimum gap between requests. Default 1000ms (1 req/s). */
  minRequestIntervalMs?: number
}

/** A radius scan request (radius in nautical miles). */
export interface RadiusScanQuery {
  lat: number
  lon: number
  radiusNm: number
  /** Optional coarse type filter (e.g. "Tanker", "Cargo"). */
  type?: string
  /** Optional fine type filter (e.g. "Crude Oil Tanker"). */
  typeSpecific?: string
}

/**
 * Thin, typed client over Datalastic's Starter-tier AIS endpoints. Returns
 * trimmed domain objects (identity + positions), not raw payloads. Requests are
 * serialized through an internal throttle to respect the plan rate limit and to
 * keep credit spend deliberate.
 *
 * Only endpoints included in the Starter plan are exposed. Add-on endpoints
 * (SAT-E, Route Tracking, ownership, inspections, casualties) would answer 403,
 * surfaced as {@link DatalasticAuthError}.
 */
export class DatalasticClient {
  private readonly transport: TransportConfig
  private readonly throttle: Throttle

  constructor(config: DatalasticClientConfig) {
    if (!config.apiKey?.trim()) {
      throw new DatalasticConfigError("apiKey is required")
    }
    this.transport = {
      baseUrl: (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
      apiKey: config.apiKey.trim(),
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    }
    this.throttle = new Throttle(config.minRequestIntervalMs ?? DEFAULT_MIN_REQUEST_INTERVAL_MS)
  }

  /** Live basic position (`/vessel`, 1 credit). Unknown vessel -> null. */
  async getVessel(selector: VesselSelector): Promise<VesselLive | null> {
    const raw = await this.throttle.run(() => fetchVessel(this.transport, selector, false))
    return raw ? mapVesselLive(raw) : null
  }

  /** Live position + current AIS draught + ETA/ATD (`/vessel_pro`, 1 credit). Unknown -> null. */
  async getVesselPro(selector: VesselSelector): Promise<VesselLive | null> {
    const raw = await this.throttle.run(() => fetchVessel(this.transport, selector, true))
    return raw ? mapVesselLive(raw) : null
  }

  /** Static ship specifications (`/vessel_info`, 1 credit). Unknown -> null. */
  async getVesselInfo(selector: VesselSelector): Promise<VesselSpecs | null> {
    const raw = await this.throttle.run(() => fetchVesselInfo(this.transport, selector))
    return raw ? mapVesselInfo(raw) : null
  }

  /**
   * Historical AIS track (`/vessel_history`). The input for dark-gap, port-call
   * and STS derivation. Credits = days × 1 vessel; defaults to the last
   * {@link DEFAULT_HISTORY_DAYS} days when no window is given. Unknown -> null.
   */
  async getVesselHistory(
    selector: VesselSelector,
    window: HistoryWindow = {},
  ): Promise<VesselTrack | null> {
    const effective: HistoryWindow =
      window.days == null && !window.from && !window.to
        ? { days: DEFAULT_HISTORY_DAYS }
        : window
    const raw = await this.throttle.run(() =>
      fetchVesselHistory(this.transport, selector, effective),
    )
    return raw ? mapVesselTrack(raw) : null
  }

  /**
   * All vessels currently within `radiusNm` of a point (`/vessel_inradius`).
   * Used for zone monitoring and STS counterparty resolution. Credits = 1 per
   * vessel returned (capped 500). Returns an empty scan when nothing is found.
   */
  async getVesselsInRadius(query: RadiusScanQuery): Promise<RadiusScan> {
    const raw = await this.throttle.run(() =>
      fetchVesselsInRadius(this.transport, {
        lat: query.lat,
        lon: query.lon,
        radius: query.radiusNm,
        type: query.type,
        typeSpecific: query.typeSpecific,
      }),
    )
    return raw
      ? mapRadiusScan(raw)
      : { center: { lat: query.lat, lon: query.lon, radiusNm: query.radiusNm }, total: 0, vessels: [] }
  }
}
