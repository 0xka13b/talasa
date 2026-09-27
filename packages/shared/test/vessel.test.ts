import { describe, it, expect } from "vitest"
import {
  createScreeningSchema, vesselBriefSchema, screeningSchema,
  VESSEL_STAGE_NAMES, VESSEL_VERDICTS, gleifParentLinkSchema,
} from "../src/vessel.js"
// The entity-graph schema moved to ./dd.ts (shared by vessel + counterparty DD).
import { entityGraphSchema, graphEdgeSchema } from "../src/dd.js"

describe("createScreeningSchema", () => {
  it("accepts a name and a 7-digit IMO", () => {
    expect(createScreeningSchema.safeParse({ name: "Acme tanker", imo: "9304162" }).success).toBe(true)
  })
  it("rejects a non-7-digit IMO", () => {
    expect(createScreeningSchema.safeParse({ name: "Acme tanker", imo: "930416" }).success).toBe(false)
    expect(createScreeningSchema.safeParse({ name: "Acme tanker", imo: "abcdefg" }).success).toBe(false)
  })
  it("treats name as optional (backfilled from the vessel name when blank)", () => {
    expect(createScreeningSchema.safeParse({ imo: "9304162" }).success).toBe(true)
    expect(createScreeningSchema.safeParse({ name: "", imo: "9304162" }).success).toBe(true)
    expect(createScreeningSchema.safeParse({ name: "   ", imo: "9304162" }).success).toBe(true)
  })
})

describe("constants", () => {
  it("has nine stages and three verdicts", () => {
    expect(VESSEL_STAGE_NAMES).toEqual(["identify", "history", "inspections", "fleet", "enrich", "sanctions", "ownership", "ais", "synthesize"])
    expect(VESSEL_VERDICTS).toEqual(["PROCEED", "CAUTION", "BLOCK"])
  })
})

describe("entityGraphSchema", () => {
  it("parses nodes + edges with kinds", () => {
    const g = {
      nodes: [
        { id: "imo:9304162", kind: "vessel", label: "SUBJECT", data: {} },
        { id: "company:5553502", kind: "legal", label: "OWNER CO", data: {} },
      ],
      edges: [{ from: "company:5553502", to: "imo:9304162", rel: "registered_owner" }],
    }
    const parsed = entityGraphSchema.safeParse(g)
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.nodes[0].sanctioned).toBe(false) // defaulted
  })
})

describe("vesselBriefSchema", () => {
  it("round-trips a minimal valid brief", () => {
    const brief = minimalBrief()
    expect(vesselBriefSchema.safeParse(brief).success).toBe(true)
  })
  it("rejects an unknown verdict", () => {
    const brief = { ...minimalBrief(), verdict: { decision: "MAYBE", score: 1, drivers: [], justification: "" } }
    expect(vesselBriefSchema.safeParse(brief).success).toBe(false)
  })
})

describe("screeningSchema", () => {
  it("defaults steps to {} when null", () => {
    const parsed = screeningSchema.safeParse({
      id: "x", name: "Acme tanker", imo: "9304162", status: "draft", vesselName: null, flag: null,
      identity: null, graph: null, brief: null, steps: null, progress: null,
      modelMeta: null, error: null, createdBy: "u", createdAt: "t", updatedAt: "t",
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.steps).toEqual({})
  })
})

describe("gleif pipeline schema additions", () => {
  it("history/inspections precede fleet; ais precedes synthesize", () => {
    expect(VESSEL_STAGE_NAMES).toEqual(["identify", "history", "inspections", "fleet", "enrich", "sanctions", "ownership", "ais", "synthesize"])
  })

  it("graph edges accept parent / ultimate_parent rels", () => {
    expect(graphEdgeSchema.parse({ from: "a", to: "b", rel: "parent" }).rel).toBe("parent")
    expect(graphEdgeSchema.parse({ from: "a", to: "b", rel: "ultimate_parent" }).rel).toBe("ultimate_parent")
  })

  it("parses a parent link", () => {
    expect(gleifParentLinkSchema.parse({ lei: "X", legalName: "ACME SA", jurisdiction: "FR" }).lei).toBe("X")
  })

  it("an OLD brief company (no GLEIF fields) still parses; parentSanctioned defaults false", () => {
    const company = { companyImo: "123", role: "ism manager", name: "Acme", address: null, sanctioned: false }
    const parsed = vesselBriefSchema.shape.companies.parse([company])
    expect(parsed[0]?.parentSanctioned).toBe(false)
    expect(parsed[0]?.lei ?? null).toBeNull()
  })

  it("a NEW brief company with GLEIF fields parses", () => {
    const company = {
      companyImo: "123", role: "ism manager", name: "Acme", address: null, sanctioned: false,
      lei: "L1", legalName: "ACME LTD", jurisdiction: "GB", registrationStatus: "ISSUED",
      directParent: { lei: "P1", legalName: "ACME GROUP", jurisdiction: "GB" },
      ultimateParent: null, parentSanctioned: true,
    }
    const parsed = vesselBriefSchema.shape.companies.parse([company])
    expect(parsed[0]?.lei).toBe("L1")
    expect(parsed[0]?.directParent?.legalName).toBe("ACME GROUP")
    expect(parsed[0]?.parentSanctioned).toBe(true)
  })
})

function minimalBrief() {
  return {
    screeningId: "s", imo: "9304162", generatedAt: "t", reportVersion: "1.0",
    identity: {
      imo: "9304162", name: "SUBJECT", flag: "Panama", type: null, grossTonnage: null,
      deadweight: null, yearBuilt: null, classSociety: null, mmsi: null, callSign: null,
      status: null, riskyFlag: false, detentionRate: null, parisMou: null, tokyoMou: null,
    },
    companies: [],
    fleet: { companies: [], sisters: [], truncated: false, note: null },
    sanctions: { status: "NO_MATCH", subjectHit: false, companyHits: [], sisterHits: [], matches: [], narrative: "" },
    signals: [],
    verdict: { decision: "PROCEED", score: 0, drivers: [], justification: "" },
    executiveSummary: "", prediction: "", recommendation: "",
    dataCompleteness: { sourcesOk: [], gaps: [] },
    modelMeta: null,
  }
}
