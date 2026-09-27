import { describe, expect, it } from "vitest"
import { detectTargets } from "../src/detect"
import type { BBox } from "../src/types"

const W = 100
const H = 100
// 1° box at the equator ≈ 111.32 km ⇒ gsd ≈ 1113 m/px over 100 px.
const BBOX: BBox = [0, 0, 1, 1]

/** A calm-water raster (low constant σ0) with optional bright blobs painted in. */
function makeRaster(blobs: Array<{ x: number; y: number; w: number; h: number; v: number }>) {
  const vh = new Float32Array(W * H).fill(0.005) // sea clutter
  const mask = new Float32Array(W * H).fill(1)
  for (const b of blobs) {
    for (let y = b.y; y < b.y + b.h; y++) {
      for (let x = b.x; x < b.x + b.w; x++) {
        vh[y * W + x] = b.v
      }
    }
  }
  return { vh, mask, width: W, height: H, bbox: BBOX }
}

describe("detectTargets", () => {
  it("finds bright blobs and reports full coverage on a clean raster", () => {
    const raster = makeRaster([
      { x: 20, y: 20, w: 4, h: 2, v: 1.0 },
      { x: 70, y: 60, w: 3, h: 3, v: 0.8 },
    ])
    const { targets, coverage, water } = detectTargets(raster, { k: 6, minAreaPx: 2 })
    expect(coverage).toBe(1)
    expect(water.threshold).toBeGreaterThan(water.mean)
    expect(targets).toHaveLength(2)
    // Brightest first.
    expect(targets[0]?.peakVh).toBeCloseTo(1.0)
  })

  it("maps a blob's centroid to lon/lat inside the bbox", () => {
    const { targets } = detectTargets(makeRaster([{ x: 50, y: 50, w: 2, h: 2, v: 1.0 }]))
    const t = targets[0]!
    // 2×2 blob at (50,50) centroids to pixel 50.5 ⇒ (50.5+0.5)/100 of a [0,1] box.
    expect(t.lon).toBeCloseTo(0.51, 3)
    expect(t.lat).toBeCloseTo(0.49, 3)
  })

  it("drops sub-minAreaPx speckle", () => {
    const raster = makeRaster([{ x: 10, y: 10, w: 1, h: 1, v: 2.0 }]) // 1 px
    expect(detectTargets(raster, { minAreaPx: 2 }).targets).toHaveLength(0)
    expect(detectTargets(raster, { minAreaPx: 1 }).targets).toHaveLength(1)
  })

  it("ignores bright pixels outside the dataMask (no-data)", () => {
    const raster = makeRaster([{ x: 30, y: 30, w: 4, h: 4, v: 1.0 }])
    // Blank the whole left half as no-data, including the blob.
    for (let y = 0; y < H; y++) for (let x = 0; x < 50; x++) raster.mask[y * W + x] = 0
    const { targets, coverage } = detectTargets(raster)
    expect(coverage).toBeCloseTo(0.5, 2)
    expect(targets).toHaveLength(0)
  })

  it("reports a longer blob's length above its width", () => {
    const { targets } = detectTargets(makeRaster([{ x: 40, y: 40, w: 8, h: 2, v: 1.0 }]))
    const t = targets[0]!
    expect(t.lengthM).toBeGreaterThan(t.widthM)
  })
})
