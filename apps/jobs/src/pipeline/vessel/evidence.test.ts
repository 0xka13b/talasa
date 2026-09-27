import { describe, it, expect } from "vitest"
import { assembleVesselEvidence } from "./evidence"
import type { EnrichedCompany } from "./enrich"
import type { VesselSanctionsResult } from "./sanctions"
import type { FleetResult } from "./types"
import type { VesselIdentity } from "@talasa/shared"

const identity: VesselIdentity = {
  imo: "9304162", name: "SUBJECT", flag: "Gabon", type: null, grossTonnage: null, deadweight: null,
  yearBuilt: null, classSociety: null, mmsi: null, callSign: null, status: null, riskyFlag: true,
  detentionRate: "15 %", parisMou: "Black (High risk)", tokyoMou: null,
}
const emptyFleet = { companies: [], sisters: [], truncated: false, note: null }
const noSanctions = { status: "NO_MATCH" as const, subjectHit: false, managementHit: false, subjectReviewMatch: false, subjectPoi: false, subjectSeverity: null, managementSeverity: null, parentSeverity: null, directSisterCount: 0, linkedSisterCount: 0, companyHits: [], sisterHits: [], parentHits: [], matches: [], unavailable: false }

describe("assembleVesselEvidence", () => {
  it("derives weak signals + a CAUTION-band verdict from a risky flag + detention + MoU", () => {
    const { evidence } = assembleVesselEvidence(identity, [], emptyFleet, noSanctions, [])
    const kinds = evidence.signals.map((s) => s.kind)
    expect(kinds).toContain("risky_flag")
    expect(kinds).toContain("detention_rate")
    expect(kinds).toContain("mou_listed")
    expect(evidence.verdict.decision).toBe("CAUTION") // 10 + 20 + 10 = 40 ≥ 35
  })
  it("surfaces flag-hopping as a weak signal + equasis_history source without moving the verdict", () => {
    const history = {
      flags: ["Gabon", "Liberia", "Panama"], names: ["SUBJECT"],
      flagChanges: 2, nameChanges: 0,
      entries: [
        { kind: "flag", value: "Gabon", from: "01/01/2023" },
        { kind: "flag", value: "Liberia", from: "01/01/2018" },
        { kind: "flag", value: "Panama", from: "01/01/2012" },
      ],
    }
    const withHistory = assembleVesselEvidence(identity, [], emptyFleet, noSanctions, [], [], history)
    const withoutHistory = assembleVesselEvidence(identity, [], emptyFleet, noSanctions, [])
    const flagSignal = withHistory.evidence.signals.find((s) => s.kind === "flag_hopping")
    expect(flagSignal?.severity).toBe("weak")
    expect(withHistory.evidence.history).toEqual(history)
    expect(withHistory.evidence.dataCompleteness.sourcesOk).toContain("equasis_history")
    // Descriptive only: the deterministic score is unchanged by history.
    expect(withHistory.evidence.verdict.score).toBe(withoutHistory.evidence.verdict.score)
  })
  it("threads PSC inspections into evidence and clears the mou_psc_detail gap", () => {
    const inspections = {
      total: 2, detentions: 1, deficiencies: 7,
      records: [
        { authority: "Romania", date: "01/01/2024", port: "Constanta", detained: true, deficiencies: 5 },
        { authority: "Spain", date: "01/06/2022", port: "Algeciras", detained: false, deficiencies: 2 },
      ],
    }
    const withInsp = assembleVesselEvidence(identity, [], emptyFleet, noSanctions, [], [], null, inspections)
    expect(withInsp.evidence.inspections).toEqual(inspections)
    expect(withInsp.evidence.dataCompleteness.sourcesOk).toContain("equasis_inspections")
    expect(withInsp.evidence.dataCompleteness.gaps).not.toContain("mou_psc_detail")
    // Without inspections, PSC detail remains a declared gap.
    const withoutInsp = assembleVesselEvidence(identity, [], emptyFleet, noSanctions, [])
    expect(withoutInsp.evidence.dataCompleteness.gaps).toContain("mou_psc_detail")
  })
  it("BLOCKs on a subject hit and lists the gap floor when sanctions failed", () => {
    const blocked = assembleVesselEvidence(identity, [], emptyFleet, { ...noSanctions, subjectHit: true, subjectSeverity: "direct", status: "CONFIRMED" }, [])
    expect(blocked.evidence.verdict.decision).toBe("BLOCK")
    const gapFloored = assembleVesselEvidence(identity, [], emptyFleet, { ...noSanctions, unavailable: true }, ["sanctions"])
    expect(gapFloored.evidence.dataCompleteness.gaps).toContain("sanctions")
    expect(gapFloored.evidence.verdict.decision).not.toBe("PROCEED")
  })
})

const enrichIdentity = { imo: "9111111", name: "SUBJECT", flag: "GB", riskyFlag: false, detentionRate: null, parisMou: null, tokyoMou: null } as VesselIdentity
const enrichFleet: FleetResult = { companies: [], sisters: [], truncated: false, note: null }
const enrichCompanies = [{ companyImo: "100", role: "ism manager", roles: ["ism manager"], name: "Acme", address: null }]

const enriched: EnrichedCompany[] = [{
  key: "100", lei: "L1", legalName: "ACME LTD", jurisdiction: "GB",
  registrationStatus: "ISSUED", entityStatus: "ACTIVE", address: "1 High St, London, GB",
  directParent: { lei: "P1", legalName: "ACME GROUP", jurisdiction: "GB", nodeId: "company:parent:P1" },
  ultimateParent: null,
}]

function sanctions(over: Partial<VesselSanctionsResult> = {}): VesselSanctionsResult {
  return { status: "NO_MATCH", subjectHit: false, managementHit: false, subjectReviewMatch: false, subjectPoi: false, subjectSeverity: null, managementSeverity: null, parentSeverity: null, directSisterCount: 0, linkedSisterCount: 0, companyHits: [], sisterHits: [], parentHits: [], matches: [], unavailable: false, ...over }
}

describe("assembleVesselEvidence with enrichment", () => {
  it("a directly-sanctioned parent -> parent_sanction signal + CAUTION verdict", () => {
    const s = sanctions({ parentHits: [{ lei: "P1", name: "ACME GROUP", subsidiaryKey: "100" }], parentSeverity: "direct" })
    const { evidence } = assembleVesselEvidence(enrichIdentity, enrichCompanies, enrichFleet, s, [], enriched)
    expect(evidence.signals.some((sig) => sig.kind === "parent_sanction" && sig.severity === "strong")).toBe(true)
    expect(evidence.verdict.decision).toBe("CAUTION")
    expect(evidence.companies[0]!.parentSanctioned).toBe(true)
  })

  it("attaches GLEIF legal fields to brief companies", () => {
    const { evidence } = assembleVesselEvidence(enrichIdentity, enrichCompanies, enrichFleet, sanctions(), [], enriched)
    expect(evidence.companies[0]).toMatchObject({ lei: "L1", legalName: "ACME LTD", jurisdiction: "GB", registrationStatus: "ISSUED" })
    expect(evidence.companies[0]!.directParent).toEqual({ lei: "P1", legalName: "ACME GROUP", jurisdiction: "GB" })
    expect(evidence.parentHits).toEqual([])
  })

  it("companies without enrichment carry no GLEIF fields and parentSanctioned=false", () => {
    const { evidence } = assembleVesselEvidence(enrichIdentity, enrichCompanies, enrichFleet, sanctions(), [])
    expect(evidence.companies[0]!.lei ?? null).toBeNull()
    expect(evidence.companies[0]!.parentSanctioned).toBe(false)
  })

  it("records an ownership gap when enrich failed", () => {
    const { evidence } = assembleVesselEvidence(enrichIdentity, enrichCompanies, enrichFleet, sanctions(), ["enrich"])
    expect(evidence.dataCompleteness.gaps).toContain("company_ownership")
  })
})
