import type { EntityGraph, GraphEdge, GraphNode } from "@talasa/shared"

export type Rel = GraphEdge["rel"]

/** Fixed display order / priority for relationship roles (lower = higher priority). */
const ROLE_ORDER: Rel[] = ["registered_owner", "ism_manager", "commercial_manager", "manager"]

export const ROLE_LABEL: Record<Rel, string> = {
  registered_owner: "Registered Owner",
  ism_manager: "ISM Manager",
  commercial_manager: "Commercial Manager",
  manager: "Manager",
  parent: "Parent",
  ultimate_parent: "Ultimate parent",
}

export interface RelCompany {
  /** The company (legal entity) node. */
  node: GraphNode
  /** All roles this company holds toward the subject, priority-sorted. */
  roles: Rel[]
  /** Highest-priority role — the section this company is grouped under. */
  primaryRole: Rel
  /** The company's other vessels (sister fleet), excluding the subject. */
  sisters: GraphNode[]
  /** Total fleet size — max of sisters present and the reported `data.vesselCount`. */
  fleetSize: number
  /** How many sisters present are sanctioned. */
  sanctionedSisters: number
  /** True when the reported fleet is larger than the sisters actually present. */
  truncated: boolean
  /** Direct/ultimate parent owners (via GLEIF), from parent edges. */
  parents: { node: GraphNode; rel: "parent" | "ultimate_parent" }[]
}

export interface RoleGroup {
  rel: Rel
  label: string
  companies: RelCompany[]
}

export interface RelationshipsModel {
  subject: GraphNode | null
  groups: RoleGroup[]
  /** Sanctioned nodes across the whole network. */
  sanctionedCount: number
}

function rolePriority(rel: Rel): number {
  const i = ROLE_ORDER.indexOf(rel)
  return i === -1 ? ROLE_ORDER.length : i
}

function toCount(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

/**
 * Transform the flat {nodes, edges} EntityGraph into a deterministic, role-grouped
 * view-model: subject → companies (grouped by their role toward it) → sister fleets.
 * Edges are directed company → vessel.
 */
export function buildRelationships(graph: EntityGraph): RelationshipsModel {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const subject = graph.nodes.find((n) => n.isSubject) ?? null
  const sanctionedCount = graph.nodes.filter((n) => n.sanctioned).length

  if (!subject) {
    return { subject: null, groups: [], sanctionedCount }
  }

  // company id -> roles held toward the subject
  const rolesByCompany = new Map<string, Set<Rel>>()
  for (const e of graph.edges) {
    if (e.to !== subject.id) continue
    const set = rolesByCompany.get(e.from) ?? new Set<Rel>()
    set.add(e.rel)
    rolesByCompany.set(e.from, set)
  }

  const companies: RelCompany[] = []
  for (const [companyId, roleSet] of rolesByCompany) {
    const node = byId.get(companyId)
    if (!node) continue

    const roles = [...roleSet].sort((a, b) => rolePriority(a) - rolePriority(b))

    // sisters = the company's other vessels (dedup, exclude the subject)
    const seen = new Set<string>()
    const sisters: GraphNode[] = []
    for (const e of graph.edges) {
      if (e.from !== companyId || e.to === subject.id || seen.has(e.to)) continue
      const target = byId.get(e.to)
      if (target && target.kind === "vessel") {
        seen.add(e.to)
        sisters.push(target)
      }
    }

    const parents: { node: GraphNode; rel: "parent" | "ultimate_parent" }[] = []
    for (const e of graph.edges) {
      if (e.from !== companyId) continue
      if (e.rel !== "parent" && e.rel !== "ultimate_parent") continue
      const target = byId.get(e.to)
      if (target) parents.push({ node: target, rel: e.rel })
    }

    const fleetSize = Math.max(sisters.length, toCount(node.data.vesselCount))
    companies.push({
      node,
      roles,
      primaryRole: roles[0],
      sisters,
      fleetSize,
      sanctionedSisters: sisters.filter((s) => s.sanctioned).length,
      truncated: fleetSize > sisters.length,
      parents,
    })
  }

  const groups: RoleGroup[] = ROLE_ORDER.map((rel) => ({
    rel,
    label: ROLE_LABEL[rel],
    companies: companies.filter((c) => c.primaryRole === rel),
  })).filter((g) => g.companies.length > 0)

  return { subject, groups, sanctionedCount }
}
