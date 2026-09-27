import { describe, expect, it } from "vitest"
import { briefSchema, caseRef, slugify, STAGE_NAMES } from "./dd.js"

describe("caseRef / slugify", () => {
  it("builds a readable, log-friendly ref", () => {
    const ref = caseRef("Hai Kuo Shipping Co., Ltd!", new Date("2026-06-28T10:00:00Z"), "a1b2c3d4-5678-90ab-cdef-111213141516")
    expect(ref).toBe("dd_20260628_hai-kuo-shipping-co-ltd_a1b2c3d4")
  })
  it("slugifies to lowercase ascii hyphens, capped", () => {
    expect(slugify("  ACME  &  Sons  Maritime  Holdings  International ")).toBe("acme-sons-maritime-holdings-int")
    expect(slugify("Société Générale")).toBe("societe-generale")
  })
})

describe("briefSchema", () => {
  it("validates a minimal brief and rejects a bad band", () => {
    const brief = {
      caseId: "x", generatedAt: "2026-06-28T10:00:00Z", reportVersion: "v1",
      dataCompleteness: { sourcesOk: ["equasis"], gaps: [] },
      counterparty: { queryName: "Acme", canonicalName: "Acme Ltd", aliases: [], country: null, resolutionConfidence: 0.9, equasisCompanyId: null },
      fleet: [], affiliations: { nodes: [], edges: [], narrative: "" },
      sanctions: { status: "NO_MATCH", matches: [], narrative: "" },
      incidents: { detentions: [], gaps: [] },
      riskScore: { value: 10, band: "CLEAR", drivers: [], justification: "" },
      recommendedAction: { decision: "CLEAR", rationale: "" },
      executiveSummary: "", modelMeta: null,
    }
    expect(briefSchema.parse(brief).riskScore.band).toBe("CLEAR")
    expect(() => briefSchema.parse({ ...brief, riskScore: { ...brief.riskScore, band: "NOPE" } })).toThrow()
  })
  it("exposes the company-centric stage names in order", () => {
    expect(STAGE_NAMES).toEqual(["resolve", "network", "ownership", "sanctions", "synthesize"])
  })
})
