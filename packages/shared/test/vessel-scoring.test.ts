import { describe, it, expect } from "vitest"
import { computeVesselVerdict, isHighRiskFlag } from "../src/vessel-scoring.js"

const base = {
  subjectSanction: null, managementSanction: null, parentSanction: null,
  directSisterCount: 0, linkedSisterCount: 0,
  riskyFlag: false, highDetention: false, mouBlackOrGrey: false,
  subjectReviewMatch: false, sanctionsUnavailable: false,
} as const

describe("computeVesselVerdict — direct designations (hard BLOCK)", () => {
  it("BLOCKs on a directly-sanctioned subject vessel (score 100)", () => {
    const r = computeVesselVerdict({ ...base, subjectSanction: "direct" })
    expect(r.decision).toBe("BLOCK")
    expect(r.score).toBe(100)
    expect(r.drivers).toContain("sanctions.subject_designated")
  })
  it("BLOCKs on a directly-sanctioned management company (score 100)", () => {
    const r = computeVesselVerdict({ ...base, managementSanction: "direct" })
    expect(r.decision).toBe("BLOCK")
    expect(r.score).toBe(100)
    expect(r.drivers).toContain("sanctions.management_designated")
  })
})

describe("computeVesselVerdict — sanction linkage (weighted, not blocking)", () => {
  it("a sanction-linked subject alone -> CAUTION (50), NOT a hard block", () => {
    const r = computeVesselVerdict({ ...base, subjectSanction: "linked" })
    expect(r.decision).toBe("CAUTION")
    expect(r.score).toBe(50)
    expect(r.drivers).toContain("sanctions.subject_linked")
  })
  it("a sanction-linked management company alone -> CAUTION (40)", () => {
    const r = computeVesselVerdict({ ...base, managementSanction: "linked" })
    expect(r.decision).toBe("CAUTION")
    expect(r.score).toBe(40)
    expect(r.drivers).toContain("sanctions.management_linked")
  })
  it("a linked subject reaches BLOCK only when it stacks with vessel-quality signals", () => {
    const r = computeVesselVerdict({ ...base, subjectSanction: "linked", highDetention: true, riskyFlag: true })
    expect(r.score).toBe(80) // 50 + 20 + 10
    expect(r.decision).toBe("BLOCK")
  })
})

describe("computeVesselVerdict — parent owners & sisters", () => {
  it("a directly-sanctioned parent owner alone -> CAUTION (50)", () => {
    const r = computeVesselVerdict({ ...base, parentSanction: "direct" })
    expect(r.decision).toBe("CAUTION")
    expect(r.score).toBe(50)
    expect(r.drivers).toContain("ownership.parent_designated")
  })
  it("a sanction-linked parent owner alone -> PROCEED (25, informational)", () => {
    const r = computeVesselVerdict({ ...base, parentSanction: "linked" })
    expect(r.decision).toBe("PROCEED")
    expect(r.score).toBe(25)
    expect(r.drivers).toContain("ownership.parent_linked")
  })
  it("a directly-sanctioned parent + a designated sister -> BLOCK (50 + 35)", () => {
    const r = computeVesselVerdict({ ...base, parentSanction: "direct", directSisterCount: 1 })
    expect(r.score).toBe(85)
    expect(r.decision).toBe("BLOCK")
  })
  it("CAUTIONs on a single designated sister (35)", () => {
    const r = computeVesselVerdict({ ...base, directSisterCount: 1 })
    expect(r.decision).toBe("CAUTION")
    expect(r.drivers).toContain("fleet.sister_designated")
  })
  it("never BLOCKs on designated sisters alone (cap 60 < 70)", () => {
    const r = computeVesselVerdict({ ...base, directSisterCount: 10 })
    expect(r.decision).toBe("CAUTION")
    expect(r.score).toBe(60)
  })
  it("linked sisters are a weak signal (2 x 15 = 30 -> PROCEED)", () => {
    const r = computeVesselVerdict({ ...base, linkedSisterCount: 2 })
    expect(r.decision).toBe("PROCEED")
    expect(r.score).toBe(30)
    expect(r.drivers).toContain("fleet.sister_linked")
  })
})

describe("computeVesselVerdict — vessel-quality signals & overlays", () => {
  it("PROCEEDs on a bare risky flag (weak only)", () => {
    const r = computeVesselVerdict({ ...base, riskyFlag: true })
    expect(r.decision).toBe("PROCEED")
    expect(r.score).toBeLessThan(35)
    expect(r.drivers).toContain("flag.high_risk")
  })
  it("floors at CAUTION when sanctions screening was unavailable", () => {
    const r = computeVesselVerdict({ ...base, sanctionsUnavailable: true })
    expect(r.decision).toBe("CAUTION")
    expect(r.drivers).toContain("sanctions.unavailable")
  })
  it("stacks weighted markers up to BLOCK", () => {
    const r = computeVesselVerdict({
      ...base, directSisterCount: 2, highDetention: true, mouBlackOrGrey: true, riskyFlag: true,
    })
    expect(r.score).toBe(100) // 60 (capped) + 20 + 10 + 10
    expect(r.decision).toBe("BLOCK")
  })
})

describe("isHighRiskFlag", () => {
  it("matches a high-risk flag case-insensitively", () => {
    expect(isHighRiskFlag("Gabon")).toBe(true)
    expect(isHighRiskFlag("cook islands")).toBe(true)
  })
  it("does not flag the FOC giants or null", () => {
    expect(isHighRiskFlag("Panama")).toBe(false)
    expect(isHighRiskFlag("Liberia")).toBe(false)
    expect(isHighRiskFlag(null)).toBe(false)
  })
})
