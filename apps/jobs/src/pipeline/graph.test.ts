import { expect, it } from "vitest"
import {
  buildCompanyGraph,
  subjectNodeId,
  companyNodeId,
  vesselNodeId,
  parentNodeId,
  roleToRel,
  type BuildGraphInput,
} from "./graph"
import type { CompanyOwnership, FleetVessel, LinkedCompany } from "@talasa/shared"

const fleet: FleetVessel[] = [
  { imo: "9000001", name: "MV Acme Star", flag: "SG", type: "Bulk Carrier", registeredOwner: "Acme Shipping Co", manager: "Acme Shipping Co" },
  { imo: "9000002", name: "MV Acme Moon", flag: "PA", type: "Tanker", registeredOwner: "Acme Shipping Co", manager: "Beta Mgmt" },
]

const linkedCompanies: LinkedCompany[] = [
  {
    companyImo: "EQ2", name: "Beta Mgmt", roles: ["ISM Manager"], sharedVesselImos: ["9000002"], sanctioned: false,
    address: "9 Raffles Quay", fleetCount: 2,
    fleet: [{ imo: "9200001", name: "MV Beta One", flag: "PA", type: "Tanker", registeredOwner: null, manager: null }],
  },
]

const ownership: CompanyOwnership = {
  lei: "L1",
  legalName: "ACME SHIPPING CO",
  jurisdiction: "SG",
  registrationStatus: "ISSUED",
  matchConfidence: "exact",
  directParent: { lei: "P1", legalName: "Acme Holdings", jurisdiction: "SG" },
  ultimateParent: { lei: "P2", legalName: "Acme Global", jurisdiction: "KY" },
}

const baseInput: BuildGraphInput = {
  equasisId: "EQ1",
  subjectName: "Acme Shipping Co",
  companyProfile: { equasisId: "EQ1", name: "Acme Shipping Co", address: "1 Marina Blvd", country: "SG", fleetCount: 2 },
  fleet,
  linkedCompanies,
  ownership,
  nodeCategories: {},
}

it("builds a subject node (isSubject), vessel nodes, and linked-company nodes", () => {
  const graph = buildCompanyGraph(baseInput)
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))

  const subject = byId.get(subjectNodeId("EQ1", "Acme Shipping Co"))
  expect(subject?.isSubject).toBe(true)
  expect(subject?.kind).toBe("legal")

  // Fleet vessels.
  expect(byId.get(vesselNodeId("9000001"))?.kind).toBe("vessel")
  expect(byId.get(vesselNodeId("9000002"))?.kind).toBe("vessel")

  // Linked company.
  const beta = byId.get(companyNodeId("EQ2", "Beta Mgmt"))
  expect(beta?.kind).toBe("legal")
  expect(beta?.isSubject).toBe(false)
})

it("edges the subject to its fleet and to its GLEIF parents", () => {
  const graph = buildCompanyGraph(baseInput)
  const subjectId = subjectNodeId("EQ1", "Acme Shipping Co")

  // subject → each vessel (owner of both).
  expect(graph.edges).toContainEqual({ from: subjectId, to: vesselNodeId("9000001"), rel: "registered_owner" })
  // subject → parents.
  expect(graph.edges).toContainEqual({ from: subjectId, to: parentNodeId("P1"), rel: "parent" })
  expect(graph.edges).toContainEqual({ from: subjectId, to: parentNodeId("P2"), rel: "ultimate_parent" })
  // linked company → shared vessel.
  expect(graph.edges).toContainEqual({ from: companyNodeId("EQ2", "Beta Mgmt"), to: vesselNodeId("9000002"), rel: "ism_manager" })
})

it("adds each affiliate's own fleet (second-level crawl) as vessel nodes edged from it", () => {
  const graph = buildCompanyGraph(baseInput)
  const betaId = companyNodeId("EQ2", "Beta Mgmt")
  const ownVessel = vesselNodeId("9200001")

  // The affiliate's own vessel is a node, distinct from the shared vessel.
  expect(graph.nodes.find((n) => n.id === ownVessel)?.kind).toBe("vessel")
  // Beta → its own vessel, using its role relation.
  expect(graph.edges).toContainEqual({ from: betaId, to: ownVessel, rel: "ism_manager" })
  // The affiliate node carries its fleet size for the UI.
  expect(graph.nodes.find((n) => n.id === betaId)?.data.fleetCount).toBe(2)
})

it("applies the sanctions nodeCategories colour to the matching node", () => {
  const graph = buildCompanyGraph({
    ...baseInput,
    nodeCategories: { [vesselNodeId("9000001")]: { sanctioned: true, category: "sanctioned" } },
  })
  const vessel = graph.nodes.find((n) => n.id === vesselNodeId("9000001"))
  expect(vessel?.sanctioned).toBe(true)
  expect(vessel?.category).toBe("sanctioned")

  // A node with no category entry stays uncoloured.
  const other = graph.nodes.find((n) => n.id === vesselNodeId("9000002"))
  expect(other?.sanctioned).toBe(false)
})

it("maps Equasis role strings to graph edge relations", () => {
  expect(roleToRel("Registered Owner")).toBe("registered_owner")
  expect(roleToRel("ISM Manager")).toBe("ism_manager")
  expect(roleToRel("Commercial Manager")).toBe("commercial_manager")
  expect(roleToRel("Something Else")).toBe("manager")
})
