import type { EntityGraph, GraphEdge, GraphNode, SanctionCategory, VesselIdentity, VesselSanctionMatch } from "@talasa/shared"
import type { EnrichedCompany } from "./enrich"
import type { FleetResult, ManagementCompany } from "./types"

// Severity order for rolling a node's several matches up to one category, using
// the SAME vocabulary the report tabs render (direct sanction is worst).
const CATEGORY_RANK: Record<SanctionCategory, number> = { sanctioned: 4, sanction_linked: 3, pep: 2, poi: 2, other: 1 }

/**
 * Worst sanction category per graph nodeId across its matches. The SINGLE source
 * every surface (graph, ownership, fleet, sidebar) reads, so a node never reads
 * "Sanctioned" on one tab and "Entity of interest" on another.
 */
export function nodeCategories(matches: VesselSanctionMatch[]): Map<string, SanctionCategory> {
  const byNode = new Map<string, SanctionCategory>()
  for (const m of matches) {
    if (!m.category) continue
    const cur = byNode.get(m.nodeId)
    if (!cur || CATEGORY_RANK[m.category] > CATEGORY_RANK[cur]) byNode.set(m.nodeId, m.category)
  }
  return byNode
}

export function roleToRel(role: string): GraphEdge["rel"] {
  const r = role.toLowerCase()
  if (r.includes("registered owner")) return "registered_owner"
  if (r.includes("ism")) return "ism_manager"
  if (r.includes("commercial")) return "commercial_manager"
  return "manager"
}

const companyNodeId = (companyImo: string | null, name: string) => companyImo ? `company:${companyImo}` : `company:${name}`

/** Assemble the Obsidian-style entity graph deterministically from the gathered
 * data: the subject vessel, its management companies (legal nodes), and the
 * sister vessels clustered around each shared company node. Sanctioned flags
 * come from the sanction match node ids. */
export function buildGraph(
  identity: VesselIdentity,
  companies: ManagementCompany[],
  fleet: FleetResult,
  matches: VesselSanctionMatch[],
  enriched: EnrichedCompany[] = [],
): EntityGraph {
  const categoryByNode = nodeCategories(matches)
  const categoryOf = (id: string): SanctionCategory | null => categoryByNode.get(id) ?? null
  // `sanctioned` is reserved for a DIRECT designation (red); linked / PEP / POI
  // carry their category and render amber, never a false "Sanctioned".
  const isSanctioned = (id: string): boolean => categoryOf(id) === "sanctioned"
  const enrichByKey = new Map(enriched.map((e) => [e.key, e]))
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const byId = new Map<string, GraphNode>()

  const add = (node: GraphNode) => { if (!byId.has(node.id)) { byId.set(node.id, node); nodes.push(node) } }

  const subjectId = `imo:${identity.imo}`
  add({ id: subjectId, kind: "vessel", label: identity.name ?? identity.imo, sub: identity.flag, sanctioned: isSanctioned(subjectId), category: categoryOf(subjectId), isSubject: true, data: { ...identity } })

  for (const co of companies) {
    const id = companyNodeId(co.companyImo, co.name)
    const e = enrichByKey.get(co.companyImo ?? co.name)
    const data: Record<string, unknown> = { ...co }
    if (e) {
      data.lei = e.lei
      data.legalName = e.legalName
      data.jurisdiction = e.jurisdiction
      data.registrationStatus = e.registrationStatus
    }
    add({ id, kind: "legal", label: co.name, sub: co.roles.join(", ") || co.role, sanctioned: isSanctioned(id), category: categoryOf(id), isSubject: false, data })
    // One edge per distinct role (deduped by rel) so ISM + commercial both show.
    for (const rel of new Set(co.roles.map(roleToRel))) edges.push({ from: id, to: subjectId, rel })

    // Parent ownership chain (deduped node by id; edge per relationship).
    const parents: [EnrichedCompany["directParent"], GraphEdge["rel"]][] = e
      ? [[e.directParent, "parent"], [e.ultimateParent, "ultimate_parent"]]
      : []
    for (const [p, rel] of parents) {
      if (!p) continue
      add({ id: p.nodeId, kind: "legal", label: p.legalName, sub: p.jurisdiction, sanctioned: isSanctioned(p.nodeId), category: categoryOf(p.nodeId), isSubject: false, data: { lei: p.lei, jurisdiction: p.jurisdiction, kind: "parent" } })
      edges.push({ from: id, to: p.nodeId, rel })
    }
  }

  for (const fc of fleet.companies) {
    const id = companyNodeId(fc.companyImo, fc.name)
    add({ id, kind: "legal", label: fc.name, sub: fc.role, sanctioned: isSanctioned(id), category: categoryOf(id), isSubject: false, data: { companyImo: fc.companyImo, name: fc.name, role: fc.role, vesselCount: fc.vesselCount } })
    for (const sis of fc.sisters) {
      const sid = `imo:${sis.imo}`
      add({ id: sid, kind: "vessel", label: sis.name ?? sis.imo, sub: sis.flag, sanctioned: isSanctioned(sid), category: categoryOf(sid), isSubject: false, data: { ...sis } })
      edges.push({ from: id, to: sid, rel: roleToRel(fc.role) })
    }
  }

  return { nodes, edges }
}
