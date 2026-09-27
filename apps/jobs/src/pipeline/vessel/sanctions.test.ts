import { describe, it, expect, vi } from "vitest"
import { screenVesselSanctions } from "./sanctions"
import type { EnrichedCompany } from "./enrich"
import type { VesselIdentity } from "@talasa/shared"
import type { ScreeningResult, ScreenTarget } from "@talasa/opensanctions"

const identity: VesselIdentity = {
  imo: "9304162", name: "SUBJECT", flag: "Panama", type: null, grossTonnage: null, deadweight: null,
  yearBuilt: null, classSociety: null, mmsi: null, callSign: null, status: null, riskyFlag: false,
  detentionRate: null, parisMou: null, tokyoMou: null,
}
const sanctionedMatch = { id: "ofac-1", caption: "BAD ENTITY", schema: "Vessel", score: 0.95, isMatch: true, target: true, sanctioned: true, topics: ["sanction"], datasets: ["us_ofac_sdn"] }
const linkedMatch = { id: "linked-1", caption: "LINKED CO", schema: "Company", score: 0.9, isMatch: true, target: false, sanctioned: true, topics: ["sanction.linked"], datasets: ["ext_graph"] }
const cleanResult = (label: string, kind: string) => ({ label, kind, decision: "clear", matches: [] })

describe("screenVesselSanctions", () => {
  it("flags a directly-sanctioned subject IMO as CONFIRMED (direct severity)", async () => {
    const c = { opensanctions: { screen: vi.fn(async (targets: any[]) => targets.map((t) =>
      t.imo === "9304162" ? { label: "subj", kind: "vessel", decision: "hit", matches: [sanctionedMatch] } : cleanResult("x", t.kind))) } } as any
    const r = await screenVesselSanctions(identity, [], [{ imo: "5555555", name: "SIS", flag: null, type: null }], c)
    expect(r.subjectHit).toBe(true)
    expect(r.subjectSeverity).toBe("direct")
    expect(r.status).toBe("CONFIRMED")
    expect(r.matches[0]!.nodeId).toBe("imo:9304162")
    expect(r.matches[0]!.tier).toBe("hit")
  })
  it("a designated sister is POSSIBLE (not CONFIRMED) and counts as a direct sister", async () => {
    const c = { opensanctions: { screen: vi.fn(async (targets: any[]) => targets.map((t) =>
      t.imo === "5555555" ? { label: "sis", kind: "vessel", decision: "hit", matches: [sanctionedMatch] } : cleanResult("x", t.kind))) } } as any
    const r = await screenVesselSanctions(identity, [], [{ imo: "5555555", name: "SIS", flag: null, type: null }], c)
    expect(r.subjectHit).toBe(false)
    expect(r.sisterHits.map((s) => s.imo)).toEqual(["5555555"])
    expect(r.directSisterCount).toBe(1)
    expect(r.status).toBe("POSSIBLE")
  })
  it("a directly-sanctioned management company is CONFIRMED (direct severity)", async () => {
    const c = { opensanctions: { screen: vi.fn(async (targets: any[]) => targets.map((t) =>
      t.kind === "company" ? { label: "co", kind: "company", decision: "review", matches: [{ ...sanctionedMatch, schema: "Company" }] } : cleanResult("x", t.kind))) } } as any
    const r = await screenVesselSanctions(identity, [{ companyImo: "5553502", role: "Registered owner", roles: ["Registered owner"], name: "OWNER CO", address: null }], [], c)
    expect(r.managementHit).toBe(true)
    expect(r.managementSeverity).toBe("direct")
    expect(r.companyHits).toContain("OWNER CO")
    expect(r.status).toBe("CONFIRMED")
  })
  it("a sanction-LINKED management company is POSSIBLE (linked severity, not a hard block)", async () => {
    const c = { opensanctions: { screen: vi.fn(async (targets: any[]) => targets.map((t) =>
      t.kind === "company" ? { label: "co", kind: "company", decision: "review", matches: [linkedMatch] } : cleanResult("x", t.kind))) } } as any
    const r = await screenVesselSanctions(identity, [{ companyImo: "5553502", role: "Commercial manager", roles: ["Commercial manager"], name: "GRIGOR MARITIME", address: null }], [], c)
    expect(r.managementHit).toBe(true)
    expect(r.managementSeverity).toBe("linked")
    expect(r.companyHits).toContain("GRIGOR MARITIME")
    expect(r.status).toBe("POSSIBLE")
  })
  it("returns NO_MATCH + unavailable=false when nothing matches", async () => {
    const c = { opensanctions: { screen: vi.fn(async (targets: any[]) => targets.map((t) => cleanResult("x", t.kind))) } } as any
    const r = await screenVesselSanctions(identity, [], [], c)
    expect(r.status).toBe("NO_MATCH")
    expect(r.unavailable).toBe(false)
  })
})

const enrichIdentity = { imo: "9111111", name: "SUBJECT", flag: "GB" } as VesselIdentity

const clear = (t: ScreenTarget): ScreeningResult => ({ label: "", kind: t.kind, decision: "clear", matches: [] })
const hit = (t: ScreenTarget): ScreeningResult => ({
  label: "", kind: t.kind, decision: "review",
  matches: [{ id: "e1", caption: "BadCo", schema: "Company", score: 0.9, isMatch: true, target: false, sanctioned: true, category: "sanctioned", topics: ["sanction"], datasets: ["us_ofac_sdn"], notes: [], description: null, firstSeen: null, lastSeen: null, lastChange: null }],
})

// Stub OpenSanctions: a target named "ACME GROUP" (the parent) is a hit; all else clear.
const enrichOpensanctions = {
  screen: async (targets: ScreenTarget[]): Promise<ScreeningResult[]> =>
    targets.map((t) => (t.kind === "company" && t.name === "ACME GROUP" ? hit(t) : clear(t))),
}

const enriched: EnrichedCompany[] = [{
  key: "100", lei: "L1", legalName: "ACME LTD", jurisdiction: "GB",
  registrationStatus: "ISSUED", entityStatus: "ACTIVE", address: null,
  directParent: { lei: "P1", legalName: "ACME GROUP", jurisdiction: "GB", nodeId: "company:parent:P1" },
  ultimateParent: null,
}]

const enrichCompanies = [{ companyImo: "100", role: "ism manager", roles: ["ism manager"], name: "Acme", address: null }]

describe("screenVesselSanctions with enrichment", () => {
  it("flags a sanctioned parent as parentHits, not managementHit", async () => {
    const r = await screenVesselSanctions(enrichIdentity, enrichCompanies, [], { opensanctions: enrichOpensanctions } as never, enriched)
    expect(r.parentHits).toEqual([{ lei: "P1", name: "ACME GROUP", subsidiaryKey: "100" }])
    expect(r.managementHit).toBe(false)
    expect(r.matches.some((m) => m.nodeId === "company:parent:P1")).toBe(true)
  })

  it("a hit on the GLEIF legal name marks the company sanctioned (managementHit/BLOCK path)", async () => {
    const os = { screen: async (ts: ScreenTarget[]) => ts.map((t) => (t.kind === "company" && t.name === "ACME LTD" ? hit(t) : clear(t))) }
    const r = await screenVesselSanctions(enrichIdentity, enrichCompanies, [], { opensanctions: os } as never, enriched)
    expect(r.managementHit).toBe(true)
    expect(r.matches.some((m) => m.nodeId === "company:100")).toBe(true)
  })

  it("surfaces a legal-name-only company hit in companyHits (Equasis name clear)", async () => {
    // "Acme" (Equasis name) screens clear; only the GLEIF legal name "ACME LTD" hits.
    const os = { screen: async (ts: ScreenTarget[]) => ts.map((t) => (t.kind === "company" && t.name === "ACME LTD" ? hit(t) : clear(t))) }
    const r = await screenVesselSanctions(enrichIdentity, enrichCompanies, [], { opensanctions: os } as never, enriched)
    expect(r.managementHit).toBe(true)
    expect(r.companyHits).toContain("Acme")
  })

  it("works with no enrichment (default []) exactly as before", async () => {
    const r = await screenVesselSanctions(enrichIdentity, enrichCompanies, [], { opensanctions: enrichOpensanctions } as never)
    expect(r.parentHits).toEqual([])
    expect(r.managementHit).toBe(false)
  })
})
