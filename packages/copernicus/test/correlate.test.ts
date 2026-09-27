import { describe, expect, it } from "vitest"
import { correlateStsCandidate, haversineM } from "../src/correlate"
import type { SarTarget } from "../src/detect"

const SITE = { lat: 6.0676, lon: 1.2656, vesselLengthM: 183, vesselBeamM: 32 }

/** A SAR target offset `dLatM`/`dLonM` metres from the loiter fix. */
function targetAt(dLatM: number, dLonM: number, extra: Partial<SarTarget> = {}): SarTarget {
  const dLat = dLatM / 111_320
  const dLon = dLonM / (111_320 * Math.cos((SITE.lat * Math.PI) / 180))
  return { lat: SITE.lat + dLat, lon: SITE.lon + dLon, lengthM: 180, widthM: 30, areaPx: 30, peakVh: 5, ...extra }
}

describe("haversineM", () => {
  it("measures a known short distance", () => {
    // ~1000 m north.
    expect(haversineM(SITE.lat, SITE.lon, SITE.lat + 1000 / 111_320, SITE.lon)).toBeCloseTo(1000, -1)
  })
})

describe("correlateStsCandidate", () => {
  it("no_detection when nothing is within the gate", () => {
    const r = correlateStsCandidate([targetAt(2000, 0)], SITE)
    expect(r.verdict).toBe("no_detection")
    expect(r.primaryMatch).toBeNull()
  })

  it("vessel_confirmed for a single hull at the fix", () => {
    const r = correlateStsCandidate([targetAt(150, 0)], SITE)
    expect(r.verdict).toBe("vessel_confirmed")
    expect(Math.round(r.matchDistanceM!)).toBe(150)
    expect(r.nearbyContacts).toHaveLength(0)
  })

  it("sts_contact when a second hull sits alongside", () => {
    const r = correlateStsCandidate([targetAt(100, 0), targetAt(100, 120)], SITE)
    expect(r.verdict).toBe("sts_contact")
    expect(r.nearbyContacts).toHaveLength(1)
  })

  it("does not treat a far-off second detection as a contact", () => {
    const r = correlateStsCandidate([targetAt(100, 0), targetAt(100, 900)], SITE)
    expect(r.verdict).toBe("vessel_confirmed")
    expect(r.nearbyContacts).toHaveLength(0)
  })

  it("beam_anomaly when the matched blob is far wider than the beam", () => {
    const r = correlateStsCandidate([targetAt(100, 0, { widthM: 80 })], SITE)
    expect(r.verdict).toBe("beam_anomaly")
  })

  it("prefers sts_contact over beam_anomaly when both hold", () => {
    const r = correlateStsCandidate([targetAt(80, 0, { widthM: 80 }), targetAt(80, 100)], SITE)
    expect(r.verdict).toBe("sts_contact")
  })
})
