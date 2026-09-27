import type { BBox } from "./types"

/**
 * A bright-target detection in a SAR σ0 raster — a candidate vessel.
 *
 * Sizes are coarse: derived from the thresholded blob's bounding box at the
 * raster ground-sample distance, so they UNDER-report length (the threshold
 * clips dim hull ends) and can OVER-report width (SAR azimuth smear). Treat them
 * as order-of-magnitude, not survey-grade — good enough to tell a 250 m tanker
 * from a 15 m skiff, not to certify two hulls alongside.
 */
export interface SarTarget {
  lat: number
  lon: number
  /** Longer bounding-box axis × ground-sample distance, metres. */
  lengthM: number
  /** Shorter bounding-box axis × ground-sample distance, metres. */
  widthM: number
  /** Connected-component size in pixels. */
  areaPx: number
  /** Peak σ0 (linear) inside the blob — a brightness/confidence proxy. */
  peakVh: number
}

/** Water-clutter statistics used to set the detection threshold. */
export interface WaterStats {
  mean: number
  std: number
  /** `mean + k·std` — pixels above this (and inside dataMask) are candidates. */
  threshold: number
}

export interface DetectResult {
  targets: SarTarget[]
  water: WaterStats
  /** Fraction of the raster actually imaged (dataMask==1). Low ⇒ swath edge. */
  coverage: number
  /** PU the underlying raster fetch billed (set by {@link CopernicusClient.detectVessels}). */
  processingUnits?: number | null
}

export interface DetectInput {
  /** Cross-pol σ0 (linear). VH separates hard targets from sea better than VV. */
  vh: Float32Array
  /** dataMask band (1 = imaged, 0 = no-data). Omit if the whole raster is valid. */
  mask?: Float32Array | null
  width: number
  height: number
  /** The geographic box the raster covers, `[west, south, east, north]`. */
  bbox: BBox
}

export interface DetectOptions {
  /** Threshold sigma multiplier. Higher ⇒ fewer, more-confident targets. Default 6. */
  k?: number
  /** Drop connected components smaller than this many pixels (speckle). Default 2. */
  minAreaPx?: number
}

/** Map a pixel centre to lon/lat within the raster's bbox (row 0 = north). */
function pixelToLonLat(px: number, py: number, width: number, height: number, bbox: BBox): [number, number] {
  const [w, s, e, n] = bbox
  const lon = w + ((px + 0.5) / width) * (e - w)
  const lat = n - ((py + 0.5) / height) * (n - s)
  return [lon, lat]
}

/**
 * Detect bright point targets (candidate vessels) in a SAR σ0 raster.
 *
 * Pure and deterministic — no I/O. Pipeline: robust water statistics over the
 * covered pixels → global `mean + k·std` threshold → 8-connected components →
 * per-blob centroid, bounding box and peak. This is the classical-CV detector
 * the task calls for; a local-window CFAR is a drop-in refinement when a uniform
 * global threshold starts producing false positives in heterogeneous sea state.
 */
export function detectTargets(input: DetectInput, options: DetectOptions = {}): DetectResult {
  const { vh, mask, width, height, bbox } = input
  const k = options.k ?? 6
  const minAreaPx = options.minAreaPx ?? 2

  // 1. Water statistics over imaged pixels. Ships are sparse, so the mean/std of
  //    all covered pixels are dominated by sea clutter.
  let n = 0, sum = 0, sumSq = 0, covered = 0
  for (let i = 0; i < vh.length; i++) {
    const imaged = !mask || mask[i] === 1
    if (imaged) covered++
    const v = vh[i] ?? Number.NaN
    if (!imaged || !Number.isFinite(v)) continue
    n++; sum += v; sumSq += v * v
  }
  const mean = n ? sum / n : 0
  const std = n ? Math.sqrt(Math.max(0, sumSq / n - mean * mean)) : 0
  const threshold = mean + k * std
  const coverage = covered / (width * height)

  // 2. Threshold mask (bright AND imaged).
  const hot = new Uint8Array(vh.length)
  for (let i = 0; i < vh.length; i++) {
    const imaged = !mask || mask[i] === 1
    hot[i] = imaged && (vh[i] ?? 0) > threshold ? 1 : 0
  }

  // 3. 8-connected components via iterative flood fill.
  const seen = new Uint8Array(vh.length)
  const gsd = (2 * groundHalfWidthKm(bbox) * 1000) / width // metres per pixel
  const targets: SarTarget[] = []

  for (let start = 0; start < hot.length; start++) {
    if (!hot[start] || seen[start]) continue
    const stack = [start]
    seen[start] = 1
    let minx = width, maxx = 0, miny = height, maxy = 0, area = 0, peak = 0, sx = 0, sy = 0
    while (stack.length) {
      const p = stack.pop() as number
      const px = p % width, py = (p / width) | 0
      area++; sx += px; sy += py
      const val = vh[p] ?? 0
      if (val > peak) peak = val
      if (px < minx) minx = px
      if (px > maxx) maxx = px
      if (py < miny) miny = py
      if (py > maxy) maxy = py
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue
          const nx = px + dx, ny = py + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const q = ny * width + nx
          if (hot[q] && !seen[q]) { seen[q] = 1; stack.push(q) }
        }
      }
    }
    if (area < minAreaPx) continue
    const [lon, lat] = pixelToLonLat(sx / area, sy / area, width, height, bbox)
    const bw = (maxx - minx + 1) * gsd
    const bh = (maxy - miny + 1) * gsd
    targets.push({
      lat, lon,
      lengthM: Math.max(bw, bh),
      widthM: Math.min(bw, bh),
      areaPx: area,
      peakVh: peak,
    })
  }

  targets.sort((a, b) => b.peakVh - a.peakVh)
  return { targets, water: { mean, std, threshold }, coverage }
}

/** Half the north-south ground extent of a bbox, in km (used for the σ0 raster gsd). */
function groundHalfWidthKm(bbox: BBox): number {
  const [, s, , n] = bbox
  return ((n - s) * 111.32) / 2
}
