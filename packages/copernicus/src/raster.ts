import { fromArrayBuffer } from "geotiff"
import type { TokenManager } from "./auth"
import { COLLECTION } from "./constants"
import { S1_SIGMA0_LINEAR } from "./evalscripts"
import type { TransportConfig } from "./http"
import { runProcess } from "./process"
import type { BBox, TimeRange } from "./types"

/** A decoded Sentinel-1 σ0 raster: three linear-power bands + geometry. */
export interface Sigma0Raster {
  /** Co-pol σ0 (linear). */
  vv: Float32Array
  /** Cross-pol σ0 (linear) — the primary band for vessel detection. */
  vh: Float32Array
  /** dataMask: 1 where the scene covers the pixel, 0 in no-data (swath edge). */
  mask: Float32Array
  width: number
  height: number
  bbox: BBox
  /** Processing units this raster fetch billed (null when decoded from bytes). */
  processingUnits: number | null
}

/** Decode a FLOAT32 3-band ({@link S1_SIGMA0_LINEAR}) GeoTIFF into its bands. */
export async function decodeSigma0Tiff(bytes: Uint8Array, bbox: BBox): Promise<Sigma0Raster> {
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const tiff = await fromArrayBuffer(ab)
  const image = await tiff.getImage()
  const bands = (await image.readRasters()) as unknown as Float32Array[]
  const [vv, vh, mask] = bands
  if (!vv || !vh || !mask) {
    throw new Error("σ0 raster did not contain the expected 3 bands (VV, VH, dataMask)")
  }
  return { vv, vh, mask, width: image.getWidth(), height: image.getHeight(), bbox, processingUnits: null }
}

/**
 * Fetch a Sentinel-1 σ0 detection raster over `bbox`/`time`: renders the raw
 * FLOAT32 VV/VH/dataMask via the Process API and decodes the GeoTIFF. This is
 * the numeric input for {@link detectTargets} — distinct from the display chips,
 * whose values are dB-scaled and clamped for the eye.
 */
export async function fetchDetectionRaster(
  transport: TransportConfig,
  tokens: TokenManager,
  query: { bbox: BBox; time: TimeRange; width: number; height: number },
): Promise<Sigma0Raster> {
  const result = await runProcess(transport, tokens, {
    collection: COLLECTION.sentinel1Grd,
    bbox: query.bbox,
    time: query.time,
    evalscript: S1_SIGMA0_LINEAR,
    width: query.width,
    height: query.height,
    format: "image/tiff",
  })
  const raster = await decodeSigma0Tiff(result.image, query.bbox)
  raster.processingUnits = result.processingUnits
  return raster
}
