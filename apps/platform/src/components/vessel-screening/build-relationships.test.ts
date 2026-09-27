import { describe, it, expect } from "vitest"
import type { EntityGraph, GraphNode } from "@talasa/shared"
import { buildRelationships } from "./build-relationships"

const subject: GraphNode = { id: "imo:1", kind: "vessel", label: "SUBJECT", sub: "Gabon", sanctioned: false, isSubject: true, data: { imo: "1", flag: "Gabon" } }
const ownerCo: GraphNode = { id: "company:owner", kind: "legal", label: "Owner Co", sub: "Registered owner", sanctioned: true, isSubject: false, data: { vesselCount: 3 } }
const mgmtCo: GraphNode = { id: "company:mgmt", kind: "legal", label: "Mgmt Co", sub: "ISM manager", sanctioned: false, isSubject: false, data: {} }
const sisterA: GraphNode = { id: "imo:2", kind: "vessel", label: "Sister A", sub: "Panama", sanctioned: true, isSubject: false, data: { imo: "2", flag: "Panama" } }
const sisterB: GraphNode = { id: "imo:3", kind: "vessel", label: "Sister B", sub: "Liberia", sanctioned: false, isSubject: false, data: { imo: "3" } }

// owner owns the subject + 2 sisters (vesselCount says 3 total → 1 not detailed);
// mgmt is both ISM and commercial manager of the subject (multi-role).
const graph: EntityGraph = {
  nodes: [subject, ownerCo, mgmtCo, sisterA, sisterB],
  edges: [
    { from: "company:owner", to: "imo:1", rel: "registered_owner" },
    { from: "company:mgmt", to: "imo:1", rel: "ism_manager" },
    { from: "company:mgmt", to: "imo:1", rel: "commercial_manager" },
    { from: "company:owner", to: "imo:2", rel: "registered_owner" },
    { from: "company:owner", to: "imo:3", rel: "registered_owner" },
  ],
}

describe("buildRelationships", () => {
  it("finds the subject and groups companies by their role toward it, in priority order", () => {
    const model = buildRelationships(graph)
    expect(model.subject?.id).toBe("imo:1")
    expect(model.groups.map((g) => g.rel)).toEqual(["registered_owner", "ism_manager"])
    expect(model.groups[0].label).toBe("Registered Owner")
    expect(model.groups[0].companies[0].node.id).toBe("company:owner")
    expect(model.groups[1].companies[0].node.id).toBe("company:mgmt")
  })

  it("lists a multi-role company once under its highest-priority role with the rest as extra roles", () => {
    const model = buildRelationships(graph)
    const mgmt = model.groups.find((g) => g.rel === "ism_manager")!.companies[0]
    expect(mgmt.primaryRole).toBe("ism_manager")
    expect(mgmt.roles).toEqual(["ism_manager", "commercial_manager"])
    // it must NOT also appear under a commercial_manager group
    expect(model.groups.some((g) => g.rel === "commercial_manager")).toBe(false)
  })

  it("collects a company's sister vessels, excluding the subject", () => {
    const model = buildRelationships(graph)
    const owner = model.groups[0].companies[0]
    expect(owner.sisters.map((s) => s.id)).toEqual(["imo:2", "imo:3"])
    expect(owner.sisters.some((s) => s.id === "imo:1")).toBe(false)
  })

  it("counts sanctioned sisters per company and sanctioned nodes across the network", () => {
    const model = buildRelationships(graph)
    expect(model.groups[0].companies[0].sanctionedSisters).toBe(1)
    expect(model.sanctionedCount).toBe(2) // ownerCo + sisterA
  })

  it("marks the fleet truncated when data.vesselCount exceeds the sisters present", () => {
    const model = buildRelationships(graph)
    const owner = model.groups[0].companies[0]
    expect(owner.fleetSize).toBe(3)
    expect(owner.truncated).toBe(true)
    const mgmt = model.groups[1].companies[0]
    expect(mgmt.fleetSize).toBe(0)
    expect(mgmt.truncated).toBe(false)
  })

  it("returns an empty model for an empty graph", () => {
    const model = buildRelationships({ nodes: [], edges: [] })
    expect(model.subject).toBeNull()
    expect(model.groups).toEqual([])
    expect(model.sanctionedCount).toBe(0)
  })

  it("returns the subject with no groups when there are no relationships", () => {
    const model = buildRelationships({ nodes: [subject], edges: [] })
    expect(model.subject?.id).toBe("imo:1")
    expect(model.groups).toEqual([])
  })

  it("attaches parent owners to a company from parent edges", () => {
    const graph = {
      nodes: [
        { id: "imo:9111111", kind: "vessel", label: "SUBJECT", sub: "GB", sanctioned: false, isSubject: true, data: { imo: "9111111" } },
        { id: "company:100", kind: "legal", label: "Acme", sub: "ism manager", sanctioned: false, isSubject: false, data: {} },
        { id: "company:parent:P1", kind: "legal", label: "ACME GROUP", sub: "GB", sanctioned: true, isSubject: false, data: { kind: "parent" } },
      ],
      edges: [
        { from: "company:100", to: "imo:9111111", rel: "ism_manager" },
        { from: "company:100", to: "company:parent:P1", rel: "parent" },
      ],
    } as never
    const model = buildRelationships(graph)
    const acme = model.groups.flatMap((g) => g.companies).find((c) => c.node.id === "company:100")!
    expect(acme.parents).toHaveLength(1)
    expect(acme.parents[0]!.node.label).toBe("ACME GROUP")
    expect(acme.parents[0]!.rel).toBe("parent")
  })
})
