import { describe, expect, it } from "vitest"
import { computeRiskScore, decideAction } from "./scoring.js"

describe("computeRiskScore", () => {
  it("clears a clean counterparty", () => {
    const s = computeRiskScore({ sanctionsStatus: "NO_MATCH", sanctionMatchCount: 0, detentionCount: 0, unresolvedBeneficialOwner: false })
    expect(s.value).toBe(0)
    expect(s.band).toBe("CLEAR")
  })
  it("forces REJECT on a confirmed sanction regardless of other signals", () => {
    const s = computeRiskScore({ sanctionsStatus: "CONFIRMED", sanctionMatchCount: 1, detentionCount: 0, unresolvedBeneficialOwner: false })
    expect(s.value).toBeGreaterThanOrEqual(70)
    expect(s.band).toBe("REJECT")
    expect(s.drivers).toContain("sanctions.confirmed")
  })
  it("caps and bands accumulating soft signals", () => {
    const s = computeRiskScore({ sanctionsStatus: "POSSIBLE", sanctionMatchCount: 2, detentionCount: 5, unresolvedBeneficialOwner: true })
    // possible 20 + detentions cap 30 + bo 5 = 55; possible never forces REJECT
    expect(s.value).toBe(55)
    expect(s.band).toBe("ENHANCED_DD")
  })
  it("lands mid-range signals in ENHANCED_DD", () => {
    const s = computeRiskScore({ sanctionsStatus: "POSSIBLE", sanctionMatchCount: 1, detentionCount: 2, unresolvedBeneficialOwner: false })
    expect(s.value).toBe(40) // possible 20 + detentions 20
    expect(s.band).toBe("ENHANCED_DD")
  })
})

describe("decideAction", () => {
  it("mirrors the band, hard-rejecting confirmed sanctions", () => {
    expect(decideAction({ value: 10, band: "CLEAR", drivers: [] }, "CONFIRMED")).toBe("REJECT")
    expect(decideAction({ value: 50, band: "ENHANCED_DD", drivers: [] }, "POSSIBLE")).toBe("ENHANCED_DD")
  })
})
