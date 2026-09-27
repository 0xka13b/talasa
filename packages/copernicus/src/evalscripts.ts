/**
 * Sentinel Hub evalscripts (v3). An evalscript declares which bands to sample
 * and how to turn them into output pixels; it runs server-side inside a Process
 * request. These cover the two talasa use cases: SAR vessel detection and a
 * true-colour optical chip.
 */

/**
 * Sentinel-1 GRD, VV polarization → single-band grayscale.
 *
 * On the sea surface, calm water is radar-dark and metal hulls are bright, so a
 * VV-backscatter chip surfaces vessels (including AIS-dark ones) as bright
 * blobs against a dark background. Values are dB-scaled and clamped to a
 * display range; feed the raw chip to a detector, or the PNG to a human.
 */
export const S1_VV_GRAYSCALE = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["VV"] }],
    output: { bands: 1, sampleType: "AUTO" },
  }
}
function evaluatePixel(s) {
  // Map linear backscatter into a 0..1 display range tuned for water + ships.
  const v = Math.max(0, Math.min(1, (10 * Math.log(s.VV) / Math.LN10 + 30) / 30))
  return [v]
}`

/**
 * Sentinel-1 GRD, VV+VH → false-colour RGB (VV, VH, VV/VH).
 *
 * Two-polarization view: ships and their wakes separate more cleanly from sea
 * clutter than in a single band. Useful as a human-readable overview chip.
 */
export const S1_VV_VH_FALSE_COLOUR = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["VV", "VH"] }],
    output: { bands: 3, sampleType: "AUTO" },
  }
}
function evaluatePixel(s) {
  const vv = Math.max(0, Math.min(1, (10 * Math.log(s.VV) / Math.LN10 + 30) / 30))
  const vh = Math.max(0, Math.min(1, (10 * Math.log(s.VH) / Math.LN10 + 35) / 30))
  const ratio = Math.max(0, Math.min(1, vv - vh + 0.5))
  return [vv, vh, ratio]
}`

/**
 * Sentinel-1 GRD raw linear σ0 for DETECTION (not display): VV, VH, and the
 * dataMask, as three FLOAT32 bands. Unlike the display evalscripts above, values
 * are left un-scaled — water sits near ~0.001–0.02, hard targets (ship hulls)
 * jump to ~0.1–1+, so a `mean + K·std` threshold over the water pixels isolates
 * vessels. The `dataMask` band is 1 where the scene actually covers the pixel
 * and 0 in no-data (swath edge) — use it to (a) confirm the AOI centre was
 * imaged and (b) exclude no-data from the water statistics.
 */
export const S1_SIGMA0_LINEAR = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["VV", "VH", "dataMask"] }],
    output: { bands: 3, sampleType: "FLOAT32" },
  }
}
function evaluatePixel(s) {
  return [s.VV, s.VH, s.dataMask]
}`

/**
 * Sentinel-1 GRD *classified* view — the clearest read of "water vs land vs
 * vessel". Instead of a continuous false colour, it buckets each pixel by its
 * dB-scaled backscatter into three flat colours: deep navy water (graded a
 * little for texture), olive land/coast, and gold vessels (strong cross-pol).
 * No-data (swath edge) is transparent, so it composites cleanly on a canvas.
 *
 * Thresholds are fixed in dB and tuned for open-water ship detection; calm vs
 * rough sea shifts the water level, so treat land/water edges as approximate —
 * the gold vessel class (VH > −14 dB, which sea clutter almost never reaches) is
 * the robust part.
 */
export const S1_SAR_TERRAIN = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["VV", "VH", "dataMask"] }],
    output: { bands: 4, sampleType: "AUTO" },
  }
}
function toDb(x) { return (10 * Math.log(Math.max(x, 1e-6))) / Math.LN10 }
function evaluatePixel(s) {
  if (s.dataMask < 1) return [0, 0, 0, 0] // transparent no-data
  var vh = toDb(s.VH)
  var vv = toDb(s.VV)
  if (vh > -14) return [1.0, 0.78, 0.1, 1] // vessel — gold
  if (vv > -11) return [0.36, 0.4, 0.24, 1] // land / very rough — olive
  var t = Math.min(1, Math.max(0, (vv + 25) / 15)) // water backscatter → subtle gradient
  return [0.03 + 0.05 * t, 0.08 + 0.12 * t, 0.2 + 0.16 * t, 1] // navy
}`

/**
 * Sentinel-2 L2A true colour (B04/B03/B02), gamma-lifted for display.
 * Daylight/cloud-dependent — use as a corroborating optical look when a SAR
 * detection needs visual confirmation.
 */
export const S2_TRUE_COLOUR = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B02", "B03", "B04"] }],
    output: { bands: 3, sampleType: "AUTO" },
  }
}
function evaluatePixel(s) {
  const g = 2.5
  return [Math.min(1, s.B04 * g), Math.min(1, s.B03 * g), Math.min(1, s.B02 * g)]
}`
