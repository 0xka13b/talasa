import { describe, it, expect } from "vitest"
import { buildGraph } from "./graph"
import type { EnrichedCompany } from "./enrich"
import type { VesselIdentity, VesselSanctionMatch } from "@talasa/shared"
import type { FleetResult } from "./types"

const identity: VesselIdentity = {
  imo: "9304162", name: "SUBJECT", flag: "Panama", type: null, grossTonnage: null, deadweight: null,
  yearBuilt: null, classSociety: null, mmsi: null, callSign: null, status: null, riskyFlag: false,
  detentionRate: null, parisMou: null, tokyoMou: null,
}
const companies = [{ companyImo: "5553502", role: "Registered owner", roles: ["Registered owner"], name: "OWNER CO", address: null }]
const fleet = {
  companies: [{ companyImo: "5553502", name: "OWNER CO", role: "Registered owner", vesselCount: 2, sampledCount: 1, sisters: [{ imo: "5555555", name: "SIS", flag: "Gabon", type: null }] }],
  sisters: [{ imo: "5555555", name: "SIS", flag: "Gabon", type: null }],
  truncated: false, note: null,
}

describe("buildGraph", () => {
  it("builds subject, legal, and sister nodes with owner edges", () => {
    const g = buildGraph(identity, companies, fleet, [])
    const subject = g.nodes.find((n) => n.id === "imo:9304162")!
    expect(subject.kind).toBe("vessel")
    expect(subject.isSubject).toBe(true)
    expect(g.nodes.find((n) => n.id === "company:5553502")?.kind).toBe("legal")
    expect(g.nodes.find((n) => n.id === "imo:5555555")?.kind).toBe("vessel")
    expect(g.edges).toContainEqual({ from: "company:5553502", to: "imo:9304162", rel: "registered_owner" })
    expect(g.edges).toContainEqual({ from: "company:5553502", to: "imo:5555555", rel: "registered_owner" })
  })
  it("marks a node sanctioned when a match targets it", () => {
    const matches: VesselSanctionMatch[] = [{ entity: "BAD", list: "us_ofac_sdn", matchField: "imo", score: 1, tier: "hit", nodeId: "imo:5555555", category: "sanctioned" }]
    const g = buildGraph(identity, companies, fleet, matches)
    expect(g.nodes.find((n) => n.id === "imo:5555555")?.sanctioned).toBe(true)
    expect(g.nodes.find((n) => n.id === "imo:9304162")?.sanctioned).toBe(false)
  })
})

describe("buildGraph with enrichment", () => {
  const identity = { imo: "9111111", name: "SUBJECT", flag: "GB" } as VesselIdentity
  const fleet: FleetResult = { companies: [], sisters: [], truncated: false, note: null }
  const companies = [{ companyImo: "100", role: "ism manager", roles: ["ism manager"], name: "Acme", address: null }]

  const enriched: EnrichedCompany[] = [{
    key: "100", lei: "L1", legalName: "ACME LTD", jurisdiction: "GB",
    registrationStatus: "ISSUED", entityStatus: "ACTIVE", address: null,
    directParent: { lei: "P1", legalName: "ACME GROUP", jurisdiction: "GB", nodeId: "company:parent:P1" },
    ultimateParent: { lei: "P2", legalName: "ACME HOLDINGS", jurisdiction: "GB", nodeId: "company:parent:P2" },
  }]

  it("adds GLEIF legal data to the company node", () => {
    const g = buildGraph(identity, companies, fleet, [], enriched)
    const co = g.nodes.find((n) => n.id === "company:100")!
    expect(co.data.lei).toBe("L1")
    expect(co.data.jurisdiction).toBe("GB")
    expect(co.data.registrationStatus).toBe("ISSUED")
  })

  it("adds parent + ultimate_parent nodes and edges", () => {
    const g = buildGraph(identity, companies, fleet, [], enriched)
    expect(g.nodes.find((n) => n.id === "company:parent:P1")?.label).toBe("ACME GROUP")
    expect(g.nodes.find((n) => n.id === "company:parent:P2")?.label).toBe("ACME HOLDINGS")
    expect(g.edges).toContainEqual({ from: "company:100", to: "company:parent:P1", rel: "parent" })
    expect(g.edges).toContainEqual({ from: "company:100", to: "company:parent:P2", rel: "ultimate_parent" })
  })

  it("marks a parent node sanctioned from its nodeId match", () => {
    const matches: VesselSanctionMatch[] = [{ entity: "ACME GROUP", list: "x", matchField: "name", score: 1, tier: "review", nodeId: "company:parent:P1", category: "sanctioned" }]
    const g = buildGraph(identity, companies, fleet, matches, enriched)
    expect(g.nodes.find((n) => n.id === "company:parent:P1")?.sanctioned).toBe(true)
  })

  it("works with no enrichment (default []) as before", () => {
    const g = buildGraph(identity, companies, fleet, [])
    expect(g.nodes.find((n) => n.id.startsWith("company:parent:"))).toBeUndefined()
  })
})
