/**
 * Deterministic company relationship-graph builder for counterparty DD.
 *
 * Mirrors the vessel pipeline's graph: stable node ids are the join key so the
 * sanctions stage and this builder colour the SAME nodes. The subject is a
 * `legal` node with `isSubject`; its fleet are `vessel` nodes; companies linked
 * through shared vessels and GLEIF parents are further `legal` nodes.
 *
 * Direction convention (matches vessel screening): a company points TO the
 * vessel it owns/manages, so subject and each linked company both edge into the
 * vessels they share — making the shared-vessel connection explicit in the graph.
 */
import type {
  CompanyOwnership,
  CompanyProfile,
  EntityGraph,
  FleetVessel,
  GraphEdge,
  GraphNode,
  LinkedCompany,
  SanctionCategory,
} from "@talasa/shared"

// ---- stable node ids (shared with sanctions.ts) ----

export function subjectNodeId(equasisId: string | null, name: string): string {
  return `company:${equasisId ?? name.toLowerCase()}`
}
export function companyNodeId(companyImo: string | null, name: string): string {
  return `company:${companyImo ?? name.toLowerCase()}`
}
export function vesselNodeId(imo: string): string {
  return `imo:${imo}`
}
export function parentNodeId(lei: string): string {
  return `company:parent:${lei}`
}

/** Per-node worst sanction category, keyed by node id (produced by the sanctions stage). */
export type NodeCategories = Record<string, { sanctioned: boolean; category: SanctionCategory }>

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim()

/** Map an Equasis role string to a graph edge relation. */
export function roleToRel(role: string): GraphEdge["rel"] {
  const r = role.toLowerCase()
  if (r.includes("registered owner") || r === "owner") return "registered_owner"
  if (r.includes("ism")) return "ism_manager"
  if (r.includes("commercial")) return "commercial_manager"
  return "manager"
}

/** The subject's edge rel to one of its own fleet vessels, inferred from the ship's owner/manager. */
function subjectRel(subjectName: string, vessel: FleetVessel): GraphEdge["rel"] {
  const subj = normalise(subjectName)
  if (vessel.registeredOwner && normalise(vessel.registeredOwner) === subj) return "registered_owner"
  if (vessel.manager && normalise(vessel.manager) === subj) return "ism_manager"
  return "manager"
}

export interface BuildGraphInput {
  equasisId: string | null
  subjectName: string
  companyProfile: CompanyProfile | null
  fleet: FleetVessel[]
  linkedCompanies: LinkedCompany[]
  ownership: CompanyOwnership | null
  nodeCategories: NodeCategories
}

export function buildCompanyGraph(input: BuildGraphInput): EntityGraph {
  const { equasisId, subjectName, companyProfile, fleet, linkedCompanies, ownership, nodeCategories } = input
  const byId = new Map<string, GraphNode>()
  const edges: GraphEdge[] = []

  const cat = (id: string) => nodeCategories[id]
  const add = (node: GraphNode) => {
    const c = cat(node.id)
    if (c) {
      node.sanctioned = node.sanctioned || c.sanctioned
      node.category = c.category
    }
    if (!byId.has(node.id)) byId.set(node.id, node)
    return node.id
  }
  const edge = (from: string, to: string, rel: GraphEdge["rel"]) => {
    if (from === to) return
    if (edges.some((e) => e.from === from && e.to === to && e.rel === rel)) return
    edges.push({ from, to, rel })
  }

  // Subject company (centre).
  const subjectId = subjectNodeId(equasisId, subjectName)
  add({
    id: subjectId,
    kind: "legal",
    label: subjectName,
    sub: companyProfile?.country ?? null,
    sanctioned: false,
    isSubject: true,
    data: {
      equasisId,
      address: companyProfile?.address ?? null,
      country: companyProfile?.country ?? null,
      fleetCount: companyProfile?.fleetCount ?? fleet.length,
      lei: ownership?.lei ?? null,
      jurisdiction: ownership?.jurisdiction ?? null,
    },
  })

  // Fleet vessels + subject→vessel edges.
  for (const v of fleet) {
    const vid = vesselNodeId(v.imo)
    add({
      id: vid,
      kind: "vessel",
      label: v.name ?? `IMO ${v.imo}`,
      sub: [v.type, v.flag].filter(Boolean).join(" · ") || null,
      sanctioned: false,
      isSubject: false,
      data: { imo: v.imo, flag: v.flag, type: v.type },
    })
    edge(subjectId, vid, subjectRel(subjectName, v))
  }

  // Linked companies → shared-vessel edges. A linked company connects to the
  // specific vessels that surfaced it, making the shared connection visible; and
  // (from the second-level crawl) to its OWN fleet, showing its wider reach.
  for (const lc of linkedCompanies) {
    const lid = companyNodeId(lc.companyImo, lc.name)
    add({
      id: lid,
      kind: "legal",
      label: lc.name,
      sub: lc.roles[0] ?? null,
      sanctioned: false,
      isSubject: false,
      data: { companyImo: lc.companyImo, roles: lc.roles, sharedVessels: lc.sharedVesselImos.length, fleetCount: lc.fleetCount, address: lc.address ?? null },
    })
    const rel = roleToRel(lc.roles[0] ?? "manager")
    // Shared vessels: the tie back to the subject.
    for (const imo of lc.sharedVesselImos) {
      const vid = vesselNodeId(imo)
      if (byId.has(vid)) edge(lid, vid, rel)
    }
    // The affiliate's own fleet (second-level): its vessels as nodes + edges, so
    // the graph shows what else it runs beyond the vessel it shares.
    for (const v of lc.fleet) {
      const vid = vesselNodeId(v.imo)
      add({
        id: vid,
        kind: "vessel",
        label: v.name ?? `IMO ${v.imo}`,
        sub: [v.type, v.flag].filter(Boolean).join(" · ") || null,
        sanctioned: false,
        isSubject: false,
        data: { imo: v.imo, flag: v.flag, type: v.type, affiliate: lc.name },
      })
      edge(lid, vid, rel)
    }
  }

  // GLEIF ownership chain.
  if (ownership?.directParent) {
    const pid = parentNodeId(ownership.directParent.lei)
    add({
      id: pid, kind: "legal", label: ownership.directParent.legalName,
      sub: ownership.directParent.jurisdiction, sanctioned: false, isSubject: false,
      data: { lei: ownership.directParent.lei, jurisdiction: ownership.directParent.jurisdiction },
    })
    edge(subjectId, pid, "parent")
  }
  if (ownership?.ultimateParent && ownership.ultimateParent.lei !== ownership.directParent?.lei) {
    const pid = parentNodeId(ownership.ultimateParent.lei)
    add({
      id: pid, kind: "legal", label: ownership.ultimateParent.legalName,
      sub: ownership.ultimateParent.jurisdiction, sanctioned: false, isSubject: false,
      data: { lei: ownership.ultimateParent.lei, jurisdiction: ownership.ultimateParent.jurisdiction },
    })
    edge(subjectId, pid, "ultimate_parent")
  }

  return { nodes: [...byId.values()], edges }
}
