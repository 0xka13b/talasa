import { describe, expect, it } from "vitest"
import {
  aisScoreInputs,
  analyzeTrack,
  detectDarkGaps,
  detectLoiters,
  detectSpeedAnomalies,
  emptyAisBehavior,
  haversineNm,
  highRiskZoneAt,
  isStsImplausibleVesselType,
  type AisFix,
} from "./ais.js"
import { computeVesselVerdict } from "./vessel-scoring.js"

const H = 3600
/** Build a fix `hoursFromBase` hours after `base`. */
function fix(base: number, hoursFromBase: number, lat: number, lon: number, speed: number | null, nav: string | null = null): AisFix {
  const epoch = base + Math.round(hoursFromBase * H)
  return { lat, lon, speed, epoch, timeUtc: new Date(epoch * 1000).toISOString(), navStatus: nav }
}

const BASE = 1_700_000_000

describe("haversineNm", () => {
  it("is ~0 for the same point and positive for distinct points", () => {
    expect(haversineNm(44.6, 37.8, 44.6, 37.8)).toBeCloseTo(0, 5)
    // ~1 degree of latitude ≈ 60 nm.
    expect(haversineNm(44, 37, 45, 37)).toBeGreaterThan(59)
    expect(haversineNm(44, 37, 45, 37)).toBeLessThan(61)
  })
})

describe("highRiskZoneAt", () => {
  it("matches Novorossiysk / Black Sea and returns null elsewhere", () => {
    expect(highRiskZoneAt(44.7, 37.8)).toBe("Novorossiysk (Black Sea)")
    expect(highRiskZoneAt(25.1, 56.6)).toBe("Fujairah OPL")
    expect(highRiskZoneAt(0, 0)).toBeNull()
    expect(highRiskZoneAt(null, 37.8)).toBeNull()
  })
})

describe("isStsImplausibleVesselType", () => {
  it("flags yachts, pleasure craft and fishing vessels (STS false-positive sources)", () => {
    expect(isStsImplausibleVesselType("Yacht")).toBe(true)
    expect(isStsImplausibleVesselType("Pleasure Craft")).toBe(true)
    expect(isStsImplausibleVesselType("Fishing Vessel")).toBe(true)
    expect(isStsImplausibleVesselType("Stern Trawler")).toBe(true)
    expect(isStsImplausibleVesselType("Sailing Vessel")).toBe(true)
  })

  it("leaves cargo/tanker types (real STS candidates) and empty types untouched", () => {
    expect(isStsImplausibleVesselType("Crude Oil Tanker")).toBe(false)
    expect(isStsImplausibleVesselType("Bulk Carrier")).toBe(false)
    expect(isStsImplausibleVesselType(null)).toBe(false)
    expect(isStsImplausibleVesselType(undefined)).toBe(false)
  })
})

describe("detectDarkGaps", () => {
  it("flags a ≥6h silence, computes distance/implied speed and the zone", () => {
    // 13h gap starting in the Black Sea (cf. DORRY dark event in the Windward report).
    const fixes = [
      fix(BASE, 0, 44.7, 37.9, 9),
      fix(BASE, 13, 44.9, 38.1, 9),
      fix(BASE, 13.5, 44.95, 38.15, 9),
    ]
    const gaps = detectDarkGaps(fixes)
    expect(gaps).toHaveLength(1)
    expect(gaps[0]!.durationHours).toBe(13)
    expect(gaps[0]!.distanceNm).toBeGreaterThan(0)
    expect(gaps[0]!.highRiskArea).toBe("Novorossiysk (Black Sea)")
  })

  it("ignores sub-threshold gaps", () => {
    const fixes = [fix(BASE, 0, 10, 10, 8), fix(BASE, 2, 10.2, 10.2, 8)]
    expect(detectDarkGaps(fixes)).toHaveLength(0)
  })

  it("dedupes repeated timestamps and needs ≥2 fixes", () => {
    expect(detectDarkGaps([fix(BASE, 0, 10, 10, 8)])).toHaveLength(0)
    const dup = [fix(BASE, 0, 10, 10, 8), fix(BASE, 0, 10, 10, 8)]
    expect(detectDarkGaps(dup)).toHaveLength(0)
  })
})

describe("detectLoiters", () => {
  it("flags a sustained mid-voyage stop as an STS candidate", () => {
    const fixes = [
      fix(BASE, 0, 14.5, -17.6, 0.1),
      fix(BASE, 4, 14.5, -17.6, 0.2),
      fix(BASE, 8, 14.5, -17.6, 0.0),
      fix(BASE, 9, 12, -18, 9), // moves off
    ]
    const loiters = detectLoiters(fixes)
    expect(loiters).toHaveLength(1)
    expect(loiters[0]!.durationHours).toBe(8)
    expect(loiters[0]!.stsCandidate).toBe(true)
  })

  it("does NOT treat a moored/anchored stop as an STS candidate", () => {
    const fixes = [
      fix(BASE, 0, 44.7, 37.8, 0.0, "Moored"),
      fix(BASE, 6, 44.7, 37.8, 0.0, "Moored"),
      fix(BASE, 7, 45, 38, 8),
    ]
    const loiters = detectLoiters(fixes)
    expect(loiters).toHaveLength(1)
    expect(loiters[0]!.stsCandidate).toBe(false)
  })

  it("ignores stops shorter than the minimum", () => {
    const fixes = [fix(BASE, 0, 10, 10, 0), fix(BASE, 1, 10, 10, 0), fix(BASE, 2, 11, 11, 9)]
    expect(detectLoiters(fixes)).toHaveLength(0)
  })
})

describe("detectSpeedAnomalies", () => {
  it("flags a teleport (implausible implied speed)", () => {
    // ~120 nm in 1h ⇒ 120 kn, impossible.
    const fixes = [fix(BASE, 0, 10, 10, 5), fix(BASE, 1, 12, 10, 5)]
    const anomalies = detectSpeedAnomalies(fixes)
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0]!.impliedSpeedKn).toBeGreaterThan(30)
  })

  it("passes a normal transit", () => {
    const fixes = [fix(BASE, 0, 10, 10, 9), fix(BASE, 1, 10.15, 10, 9)]
    expect(detectSpeedAnomalies(fixes)).toHaveLength(0)
  })
})

describe("analyzeTrack + aisScoreInputs", () => {
  it("summarises coverage and reduces to verdict inputs", () => {
    const fixes = [
      fix(BASE, 0, 44.7, 37.9, 9),
      fix(BASE, 13, 44.9, 38.1, 0.1), // dark gap into the Black Sea, then stops
      fix(BASE, 17, 44.9, 38.1, 0.0),
    ]
    const b = analyzeTrack(fixes)
    expect(b.available).toBe(true)
    expect(b.positionCount).toBe(3)
    expect(b.spanDays).toBeCloseTo(17 / 24, 1)
    expect(b.darkGaps).toHaveLength(1)

    const inputs = aisScoreInputs(b)
    expect(inputs.darkGapCount).toBe(1)
    expect(inputs.darkGapInHighRiskZone).toBe(true)
  })

  it("emptyAisBehavior marks unavailable with zero events", () => {
    const b = emptyAisBehavior(false)
    expect(b.available).toBe(false)
    expect(aisScoreInputs(b)).toEqual({
      darkGapCount: 0,
      darkGapInHighRiskZone: false,
      stsCandidateCount: 0,
      speedAnomalyCount: 0,
    })
  })
})

describe("AIS contribution to computeVesselVerdict", () => {
  const clean = {
    subjectSanction: null, managementSanction: null, parentSanction: null,
    directSisterCount: 0, linkedSisterCount: 0,
    riskyFlag: false, highDetention: false, mouBlackOrGrey: false,
    subjectReviewMatch: false, sanctionsUnavailable: false,
  } as const

  it("adds nothing when no AIS fields are supplied (back-compat)", () => {
    expect(computeVesselVerdict(clean).score).toBe(0)
  })

  it("lifts the score for a high-risk dark gap + STS candidate", () => {
    const v = computeVesselVerdict({ ...clean, darkGapInHighRiskZone: true, stsCandidateCount: 1 })
    expect(v.score).toBe(35) // 20 + 15
    expect(v.decision).toBe("CAUTION")
    expect(v.drivers).toContain("ais.dark_gap_high_risk")
    expect(v.drivers).toContain("ais.sts_candidate")
  })

  it("never lets AIS behaviour override a subject sanctions BLOCK", () => {
    const v = computeVesselVerdict({ ...clean, subjectSanction: "direct", speedAnomalyCount: 3 })
    expect(v.decision).toBe("BLOCK")
    expect(v.score).toBe(100)
    expect(v.drivers).not.toContain("ais.speed_anomaly")
  })
})
