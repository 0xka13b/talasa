import { describe, it, expect, vi } from "vitest"
import { synthesizeVessel } from "./synthesize"
import { vesselBriefSchema, type VesselIdentity } from "@talasa/shared"
import type { EnrichedCompany } from "./enrich"
import type { VesselSanctionsResult } from "./sanctions"
import type { FleetResult } from "./types"

const identity: VesselIdentity = {
  imo: "9304162", name: "SUBJECT", flag: "Gabon", type: null, grossTonnage: null, deadweight: null,
  yearBuilt: null, classSociety: null, mmsi: null, callSign: null, status: null, riskyFlag: true,
  detentionRate: null, parisMou: null, tokyoMou: null,
}
const emptyFleet = { companies: [], sisters: [], truncated: false, note: null }
const blockingSanctions = { status: "CONFIRMED" as const, subjectHit: true, managementHit: false, subjectReviewMatch: false, subjectPoi: false, subjectSeverity: "direct" as const, managementSeverity: null, parentSeverity: null, directSisterCount: 0, linkedSisterCount: 0, companyHits: [], sisterHits: [], parentHits: [], matches: [{ entity: "BAD", list: "us_ofac_sdn", matchField: "imo", score: 1, tier: "hit" as const, nodeId: "imo:9304162", category: "sanctioned" as const }], unavailable: false }

describe("synthesizeVessel", () => {
  it("produces a valid brief; the LLM cannot override the BLOCK verdict", async () => {
    const c = { inference: { synthesizeVesselBrief: vi.fn(async () => ({
      fields: { executiveSummary: "es", sanctionsNarrative: "sn", prediction: "pred", recommendation: "rec" },
      usage: { model: "m", inputTokens: 1, outputTokens: 2, cachedTokens: 0 },
    })) } } as any
    const { brief, graph } = await synthesizeVessel("9304162", identity, [], emptyFleet, blockingSanctions, c, [], "screen-1")
    expect(vesselBriefSchema.safeParse(brief).success).toBe(true)
    expect(brief.verdict.decision).toBe("BLOCK") // deterministic, not from the LLM
    expect(brief.executiveSummary).toBe("es")
    expect(brief.prediction).toBe("pred")
    expect(graph.nodes.find((n) => n.id === "imo:9304162")?.sanctioned).toBe(true)
  })
})

const enrichIdentity = { imo: "9111111", name: "SUBJECT", flag: "GB", riskyFlag: false, detentionRate: null, parisMou: null, tokyoMou: null } as VesselIdentity
const enrichFleet: FleetResult = { companies: [], sisters: [], truncated: false, note: null }
const enrichCompanies = [{ companyImo: "100", role: "ism manager", roles: ["ism manager"], name: "Acme", address: null }]
const enrichSanctions: VesselSanctionsResult = { status: "POSSIBLE", subjectHit: false, managementHit: false, subjectReviewMatch: false, subjectPoi: false, subjectSeverity: null, managementSeverity: null, parentSeverity: "direct", directSisterCount: 0, linkedSisterCount: 0, companyHits: [], sisterHits: [], parentHits: [{ lei: "P1", name: "ACME GROUP", subsidiaryKey: "100" }], matches: [], unavailable: false }
const enriched: EnrichedCompany[] = [{ key: "100", lei: "L1", legalName: "ACME LTD", jurisdiction: "GB", registrationStatus: "ISSUED", entityStatus: "ACTIVE", address: null, directParent: { lei: "P1", legalName: "ACME GROUP", jurisdiction: "GB", nodeId: "company:parent:P1" }, ultimateParent: null }]

function inferenceStub() {
  return {
    synthesizeVesselBrief: vi.fn(async (evidence: unknown) => ({
      fields: { executiveSummary: "s", sanctionsNarrative: "n", prediction: "p", recommendation: "r" },
      usage: { model: "m", inputTokens: 1, outputTokens: 1, cachedTokens: 0 },
      _evidence: evidence,
    })),
  }
}

describe("synthesizeVessel threads enrichment", () => {
  it("passes enriched company legal data + parentHits into the evidence given to the LLM", async () => {
    const inference = inferenceStub()
    const { brief } = await synthesizeVessel("9111111", enrichIdentity, enrichCompanies, enrichFleet, enrichSanctions, { inference } as never, [], "vs1", enriched)
    const evidence = inference.synthesizeVesselBrief.mock.calls[0]![0] as { companies: { lei?: string | null }[]; parentHits: unknown[] }
    expect(evidence.companies[0]!.lei).toBe("L1")
    expect(evidence.parentHits).toHaveLength(1)
    // verdict still deterministic (CAUTION from the parent hit), LLM cannot override
    expect(brief.verdict.decision).toBe("CAUTION")
    expect(brief.companies[0]!.directParent?.legalName).toBe("ACME GROUP")
  })
})
