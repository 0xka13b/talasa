import { describe, expect, it, vi } from "vitest"
import { briefSchema } from "@talasa/shared"
import type { ResolvedEntity, CompanyOwnership, BriefLLMFields } from "@talasa/shared"
import type { NetworkResult } from "./network"
import type { SanctionsResult } from "./sanctions"
import { assembleEvidence, synthesize } from "./synthesize"
import { subjectNodeId, vesselNodeId, companyNodeId, parentNodeId } from "./graph"
import type { CaseInput } from "./types"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const input: CaseInput = {
  queryName: "Acme Shipping Co",
  companyImo: "EQ1",
  companyAddress: "1 Marina Blvd, Singapore",
  role: "charterer",
  country: "SG",
}

const resolved: ResolvedEntity = {
  canonicalName: "Acme Shipping Co",
  aliases: ["ACME SHIP"],
  country: "SG",
  address: "1 Marina Blvd, Singapore",
  equasisCompanyId: "EQ1",
  fleetImos: ["9000001", "9000002"],
  sanctionsEntityId: "NK-001",
  confidence: 0.9,
}

const network: NetworkResult = {
  companyProfile: { equasisId: "EQ1", name: "Acme Shipping Co", address: "1 Marina Blvd", country: "SG", fleetCount: 2 },
  fleet: [
    { imo: "9000001", name: "MV Acme Star", flag: "SG", type: "Bulk Carrier", registeredOwner: "Acme Shipping Co", manager: "Acme Shipping Co" },
    { imo: "9000002", name: "MV Acme Moon", flag: "PA", type: "Tanker", registeredOwner: "Acme Shipping Co", manager: "Beta Mgmt" },
  ],
  linkedCompanies: [
    {
      companyImo: "EQ2", name: "Beta Mgmt", roles: ["ISM Manager"], sharedVesselImos: ["9000002"], sanctioned: false,
      address: "9 Raffles Quay, Singapore", fleetCount: 3,
      fleet: [{ imo: "9100001", name: "MV Beta One", flag: "PA", type: "Tanker", registeredOwner: null, manager: null }],
    },
  ],
  owners: ["Acme Shipping Co"],
  managers: ["Acme Shipping Co", "Beta Mgmt"],
  detentions: [],
  affiliations: { nodes: [{ name: "Beta Mgmt", role: "ISM Manager", country: null }], edges: [] },
  truncated: false,
}

const ownership: CompanyOwnership = {
  lei: "5493001KJTIIGC8Y1R12",
  legalName: "ACME SHIPPING CO",
  jurisdiction: "SG",
  registrationStatus: "ISSUED",
  matchConfidence: "exact",
  directParent: { lei: "PARENT-LEI-1", legalName: "Acme Holdings", jurisdiction: "SG" },
  ultimateParent: { lei: "PARENT-LEI-2", legalName: "Acme Global", jurisdiction: "KY" },
}

const sanctionsConfirmed: SanctionsResult = {
  status: "CONFIRMED",
  matches: [
    { entity: "MV Acme Star", list: "us_ofac_sdn", matchField: "imo", score: 0.97, tier: 1, datasets: ["us_ofac_sdn"], topics: ["sanction"], category: "sanctioned" },
  ],
  nodeCategories: { [vesselNodeId("9000001")]: { sanctioned: true, category: "sanctioned" } },
}

const sanctionsClear: SanctionsResult = { status: "NO_MATCH", matches: [], nodeCategories: {} }

/** Mock LLM fields that claim everything is clear (the decisive override test). */
const optimisticLLMFields: BriefLLMFields = {
  executiveSummary: "This counterparty looks completely clear with no issues.",
  affiliationsNarrative: "Affiliations appear benign.",
  ownershipNarrative: "Ownership resolves to a single group.",
  sanctionsNarrative: "No sanctions exposure found.",
  riskJustification: "Low risk overall.",
  recommendedActionRationale: "Approve without restriction.",
}

const mockUsage = { model: "gpt-4o", inputTokens: 200, outputTokens: 80, cachedTokens: 0 }

const makeInference = (fields: BriefLLMFields = optimisticLLMFields, usage = mockUsage) => ({
  synthesizeBrief: vi.fn().mockResolvedValue({ fields, usage }),
})

// ---------------------------------------------------------------------------
// assembleEvidence — pure function, no LLM
// ---------------------------------------------------------------------------

describe("assembleEvidence", () => {
  it("sets riskScore.band and decision to REJECT for a CONFIRMED sanction", () => {
    const evidence = assembleEvidence(input, resolved, network, ownership, sanctionsConfirmed, [])
    expect(evidence.riskScore.band).toBe("REJECT")
    expect(evidence.decision).toBe("REJECT")
  })

  it("sets riskScore.band and decision to CLEAR for a clean NO_MATCH", () => {
    const evidence = assembleEvidence(input, resolved, network, ownership, sanctionsClear, [])
    expect(evidence.riskScore.band).toBe("CLEAR")
    expect(evidence.decision).toBe("CLEAR")
  })

  it("includes sanction matches in evidence.sanctions.matches", () => {
    const evidence = assembleEvidence(input, resolved, network, ownership, sanctionsConfirmed, [])
    expect(evidence.sanctions.matches).toHaveLength(1)
    expect(evidence.sanctions.matches[0]!.entity).toBe("MV Acme Star")
  })

  it("copies companyProfile, fleet and linkedCompanies (with their own fleet) from the network result", () => {
    const evidence = assembleEvidence(input, resolved, network, ownership, sanctionsClear, [])
    expect(evidence.companyProfile?.equasisId).toBe("EQ1")
    expect(evidence.fleet).toHaveLength(2)
    expect(evidence.linkedCompanies).toHaveLength(1)
    expect(evidence.linkedCompanies[0]!.name).toBe("Beta Mgmt")
    // Second-level crawl: the affiliate carries its own fleet + address.
    expect(evidence.linkedCompanies[0]!.fleetCount).toBe(3)
    expect(evidence.linkedCompanies[0]!.fleet[0]!.name).toBe("MV Beta One")
    expect(evidence.linkedCompanies[0]!.address).toBe("9 Raffles Quay, Singapore")
  })

  it("carries the counterparty role and the GLEIF ownership through to the evidence", () => {
    const evidence = assembleEvidence(input, resolved, network, ownership, sanctionsClear, [])
    expect(evidence.counterparty.role).toBe("charterer")
    expect(evidence.ownership?.lei).toBe("5493001KJTIIGC8Y1R12")
  })

  it("propagates failedStages as gaps in dataCompleteness", () => {
    const evidence = assembleEvidence(input, resolved, network, ownership, sanctionsClear, ["sanctions"])
    expect(evidence.dataCompleteness.gaps).toContain("sanctions")
  })

  it("flags corporate_ownership as a gap when GLEIF returned nothing", () => {
    const evidence = assembleEvidence(input, resolved, network, null, sanctionsClear, [])
    expect(evidence.dataCompleteness.gaps).toContain("corporate_ownership")
    expect(evidence.dataCompleteness.gaps).toContain("beneficial_owner")
  })
})

// ---------------------------------------------------------------------------
// synthesize — assembleEvidence + graph + one LLM call, merged
// ---------------------------------------------------------------------------

describe("synthesize", () => {
  it("keeps decision REJECT even when the LLM narrative says everything is clear", async () => {
    const inference = makeInference()
    const { brief } = await synthesize(input, resolved, network, ownership, sanctionsConfirmed, { inference } as any)
    expect(brief.recommendedAction.decision).toBe("REJECT")
    expect(brief.riskScore.band).toBe("REJECT")
  })

  it("produces a brief that passes briefSchema.parse", async () => {
    const inference = makeInference()
    const { brief } = await synthesize(input, resolved, network, ownership, sanctionsConfirmed, { inference } as any)
    expect(() => briefSchema.parse(brief)).not.toThrow()
    expect(briefSchema.parse(brief)).toBeTruthy()
  })

  it("carries the relationship graph (subject + fleet + linked + parents) and linkedCompanies", async () => {
    const inference = makeInference()
    const { brief } = await synthesize(input, resolved, network, ownership, sanctionsClear, { inference } as any)

    const ids = brief.graph!.nodes.map((n) => n.id)
    // subject
    const subject = brief.graph!.nodes.find((n) => n.id === subjectNodeId("EQ1", "Acme Shipping Co"))
    expect(subject?.isSubject).toBe(true)
    // fleet vessels (subject's two) + the affiliate's own vessel from the
    // second-level crawl (MV Beta One, 9100001), edged from Beta Mgmt.
    expect(ids).toContain(vesselNodeId("9000001"))
    expect(ids).toContain(vesselNodeId("9000002"))
    expect(ids).toContain(vesselNodeId("9100001"))
    expect(brief.graph!.nodes.filter((n) => n.kind === "vessel")).toHaveLength(3)
    expect(brief.graph!.edges).toContainEqual({ from: companyNodeId("EQ2", "Beta Mgmt"), to: vesselNodeId("9100001"), rel: "ism_manager" })
    // linked company
    expect(ids).toContain(companyNodeId("EQ2", "Beta Mgmt"))
    // GLEIF parents
    expect(ids).toContain(parentNodeId("PARENT-LEI-1"))
    expect(ids).toContain(parentNodeId("PARENT-LEI-2"))
    expect(brief.graph!.edges.some((e) => e.rel === "parent")).toBe(true)
    expect(brief.graph!.edges.some((e) => e.rel === "ultimate_parent")).toBe(true)
    // linkedCompanies mirrored on the brief
    expect(brief.linkedCompanies).toHaveLength(1)
    expect(brief.linkedCompanies[0]!.name).toBe("Beta Mgmt")
  })

  it("colours graph nodes from the sanctions nodeCategories", async () => {
    const inference = makeInference()
    const { brief } = await synthesize(input, resolved, network, ownership, sanctionsConfirmed, { inference } as any)
    const vessel = brief.graph!.nodes.find((n) => n.id === vesselNodeId("9000001"))
    expect(vessel?.sanctioned).toBe(true)
    expect(vessel?.category).toBe("sanctioned")
  })

  it("maps every LLM narrative field into the brief, including ownershipNarrative", async () => {
    const customFields: BriefLLMFields = {
      executiveSummary: "CUSTOM EXEC SUMMARY",
      affiliationsNarrative: "CUSTOM AFF NARRATIVE",
      ownershipNarrative: "CUSTOM OWNERSHIP NARRATIVE",
      sanctionsNarrative: "CUSTOM SANCTIONS NARRATIVE",
      riskJustification: "CUSTOM RISK JUSTIFICATION",
      recommendedActionRationale: "CUSTOM RATIONALE",
    }
    const inference = makeInference(customFields)
    const { brief } = await synthesize(input, resolved, network, ownership, sanctionsClear, { inference } as any)

    expect(brief.executiveSummary).toBe("CUSTOM EXEC SUMMARY")
    expect(brief.affiliations.narrative).toBe("CUSTOM AFF NARRATIVE")
    expect(brief.ownershipNarrative).toBe("CUSTOM OWNERSHIP NARRATIVE")
    expect(brief.sanctions.narrative).toBe("CUSTOM SANCTIONS NARRATIVE")
    expect(brief.riskScore.justification).toBe("CUSTOM RISK JUSTIFICATION")
    expect(brief.recommendedAction.rationale).toBe("CUSTOM RATIONALE")
  })

  it("merges modelMeta from LLM usage into the brief", async () => {
    const inference = makeInference()
    const { brief } = await synthesize(input, resolved, network, ownership, sanctionsClear, { inference } as any)
    expect(brief.modelMeta).toMatchObject(mockUsage)
  })

  it("passes evidence (not raw inputs) to inference.synthesizeBrief", async () => {
    const inference = makeInference()
    await synthesize(input, resolved, network, ownership, sanctionsClear, { inference } as any)

    expect(inference.synthesizeBrief).toHaveBeenCalledOnce()
    const evidenceArg = (inference.synthesizeBrief.mock.calls[0] as unknown[])[0] as Record<string, unknown>
    expect(evidenceArg).toHaveProperty("riskScore")
    expect(evidenceArg).toHaveProperty("decision")
    expect(evidenceArg).toHaveProperty("counterparty")
    expect(evidenceArg).toHaveProperty("companyProfile")
    expect(evidenceArg).toHaveProperty("linkedCompanies")
  })

  it("returns the usage from the LLM call", async () => {
    const inference = makeInference()
    const { usage } = await synthesize(input, resolved, network, ownership, sanctionsClear, { inference } as any)
    expect(usage).toMatchObject(mockUsage)
  })

  it("keeps counterparty identity + role in the brief", async () => {
    const inference = makeInference()
    const { brief } = await synthesize(input, resolved, network, ownership, sanctionsClear, { inference } as any)
    expect(brief.counterparty.canonicalName).toBe("Acme Shipping Co")
    expect(brief.counterparty.queryName).toBe("Acme Shipping Co")
    expect(brief.counterparty.aliases).toEqual(["ACME SHIP"])
    expect(brief.counterparty.role).toBe("charterer")
  })

  it("uses the provided caseId when given", async () => {
    const inference = makeInference()
    const { brief } = await synthesize(input, resolved, network, ownership, sanctionsClear, { inference } as any, [], "case-123")
    expect(brief.caseId).toBe("case-123")
  })
})
