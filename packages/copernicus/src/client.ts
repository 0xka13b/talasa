import { TokenManager } from "./auth"
import { searchCatalog } from "./catalog"
import {
  COLLECTION,
  DEFAULT_BASE_URL,
  DEFAULT_MIN_REQUEST_INTERVAL_MS,
  DEFAULT_TIMEOUT_MS,
} from "./constants"
import { detectTargets } from "./detect"
import type { DetectOptions, DetectResult } from "./detect"
import { CopernicusConfigError } from "./errors"
import type { TransportConfig } from "./http"
import { S1_VV_GRAYSCALE } from "./evalscripts"
import { runProcess } from "./process"
import { fetchDetectionRaster } from "./raster"
import type { Sigma0Raster } from "./raster"
import { Throttle } from "./throttle"
import type { BBox, CatalogQuery, CatalogScene, ProcessQuery, ProcessResult, TimeRange } from "./types"

export interface CopernicusClientConfig {
  /** OAuth2 client ID minted in the CDSE dashboard (Sentinel Hub → OAuth clients). */
  clientId: string
  /** OAuth2 client secret paired with {@link clientId}. */
  clientSecret: string
  baseUrl?: string
  tokenEndpoint?: string
  timeoutMs?: number
  /** Minimum gap between requests. Default 500ms. */
  minRequestIntervalMs?: number
}

/** A SAR chip request around a point. `radiusKm` sets the AOI half-width. */
export interface SarChipQuery {
  lat: number
  lon: number
  /** Half-width of the square AOI, in km. Keep small (a few km) to bound PU cost. */
  radiusKm: number
  time: TimeRange
  /** Output raster edge in pixels. Default 512 (~a few km at 10m/px). */
  sizePx?: number
}

/** Metres per degree of latitude (constant); longitude is scaled by cos(lat). */
const M_PER_DEG_LAT = 111_320

/**
 * Square WGS84 bounding box of half-width `radiusKm` around a point. Longitude
 * degrees shrink toward the poles, so we divide by cos(latitude).
 */
export function bboxAround(lat: number, lon: number, radiusKm: number): BBox {
  const dLat = (radiusKm * 1000) / M_PER_DEG_LAT
  const dLon = (radiusKm * 1000) / (M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180))
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat]
}

/**
 * Thin, typed client over the Copernicus Data Space Ecosystem Sentinel Hub APIs.
 *
 * Two surfaces, split by cost:
 *  - {@link searchScenes} — STAC catalog search. FREE. Use it to confirm a scene
 *    exists over an AOI/date (and check cloud cover) before spending anything.
 *  - {@link getImage} / {@link sarChip} — Process API. PU-metered; renders an AOI
 *    into image bytes and reports the processing units it billed.
 *
 * Auth is OAuth2 client-credentials, handled internally: a bearer token is
 * minted once, cached until near expiry, and refreshed transparently. Requests
 * are serialized through a throttle to respect the account rate limit and keep
 * PU spend deliberate.
 */
export class CopernicusClient {
  private readonly transport: TransportConfig
  private readonly tokens: TokenManager
  private readonly throttle: Throttle

  constructor(config: CopernicusClientConfig) {
    if (!config.clientId?.trim() || !config.clientSecret?.trim()) {
      throw new CopernicusConfigError("clientId and clientSecret are required")
    }
    this.transport = {
      baseUrl: (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    }
    this.tokens = new TokenManager({
      clientId: config.clientId.trim(),
      clientSecret: config.clientSecret.trim(),
      tokenEndpoint: config.tokenEndpoint,
      timeoutMs: this.transport.timeoutMs,
    })
    this.throttle = new Throttle(config.minRequestIntervalMs ?? DEFAULT_MIN_REQUEST_INTERVAL_MS)
  }

  /** STAC catalog search (FREE). Scenes over the AOI+time, newest first. */
  async searchScenes(query: CatalogQuery): Promise<CatalogScene[]> {
    return this.throttle.run(() => searchCatalog(this.transport, this.tokens, query))
  }

  /** Process API (PU-metered). Render an AOI+time through an evalscript to image bytes. */
  async getImage(query: ProcessQuery): Promise<ProcessResult> {
    return this.throttle.run(() => runProcess(this.transport, this.tokens, query))
  }

  /**
   * Fetch the raw Sentinel-1 σ0 detection raster (FLOAT32 VV/VH/dataMask) for an
   * AOI+time — the numeric input for {@link detectVessels}, distinct from the
   * display chips. PU-metered.
   */
  async getDetectionRaster(query: {
    bbox: BBox
    time: TimeRange
    width: number
    height: number
  }): Promise<Sigma0Raster> {
    return this.throttle.run(() => fetchDetectionRaster(this.transport, this.tokens, query))
  }

  /**
   * Detect candidate vessels over an AOI+time: fetch the σ0 raster and run the
   * classical-CV detector. Inspect {@link DetectResult.coverage} first — a low
   * value means the swath edge left the AOI in no-data and the targets are
   * unreliable.
   */
  async detectVessels(
    query: { bbox: BBox; time: TimeRange; width?: number; height?: number },
    options?: DetectOptions,
  ): Promise<DetectResult> {
    const width = query.width ?? 1024
    const height = query.height ?? 1024
    const raster = await this.getDetectionRaster({ bbox: query.bbox, time: query.time, width, height })
    const result = detectTargets(
      { vh: raster.vh, mask: raster.mask, width: raster.width, height: raster.height, bbox: raster.bbox },
      options,
    )
    result.processingUnits = raster.processingUnits
    return result
  }

  /**
   * Convenience: a Sentinel-1 VV grayscale SAR chip centred on a point — the
   * standard input for dark-vessel detection. Builds the AOI from `radiusKm`,
   * renders a `sizePx²` PNG, and returns the bytes + PU cost.
   */
  async sarChip(query: SarChipQuery): Promise<ProcessResult> {
    const size = query.sizePx ?? 512
    return this.getImage({
      collection: COLLECTION.sentinel1Grd,
      bbox: bboxAround(query.lat, query.lon, query.radiusKm),
      time: query.time,
      evalscript: S1_VV_GRAYSCALE,
      width: size,
      height: size,
      format: "image/png",
    })
  }
}
