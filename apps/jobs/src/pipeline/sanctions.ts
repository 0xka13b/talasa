import type { SanctionMatch, SanctionCategory, LinkedCompany, CompanyOwnership } from "@talasa/shared"
import { classifyCategory } from "@talasa/opensanctions"
import type { OpenSanctionsClient, ScreeningResult, CompanyTarget } from "@talasa/opensanctions"
import { MAX_VESSELS_SCREENED } from "./types"
import { subjectNodeId, companyNodeId, parentNodeId, vesselNodeId, type NodeCategories } from "./graph"

type SanctionsClients = Pick<{ opensanctions: OpenSanctionsClient }, "opensanctions">
type CompanyScreenTarget = Omit<CompanyTarget, "kind">

export type SanctionsStatus = "NO_MATCH" | "POSSIBLE" | "CONFIRMED"

export interface SanctionsResult {
  status: SanctionsStatus
  matches: SanctionMatch[]
  /** Worst sanction category per graph node id — drives graph colouring + list badges. */
  nodeCategories: NodeCategories
}

export interface SanctionsInput {
  subjectName: string
  equasisId: string | null
  country: string | null
  linkedCompanies: LinkedCompany[]
  ownership: CompanyOwnership | null
  fleetImos: string[]
}

const CATEGORY_RANK: Record<SanctionCategory, number> = { sanctioned: 4, sanction_linked: 3, pep: 2, poi: 2, other: 1 }

/**
 * Screen the whole counterparty network against OpenSanctions: the subject
 * company, every linked company, the GLEIF parents (all by name), and a capped
 * set of fleet vessels (by IMO). Each target carries its graph node id as the
 * screening `label`, so results map back to exact nodes for colouring — no fuzzy
 * name matching downstream.
 *
 * Status: CONFIRMED only on an identifier-tier hit with a DIRECT designation
 * (a vessel listed by IMO); a name-only company match is POSSIBLE (review), not
 * a confirmed designation — the deliberate conservative stance for name matching.
 */
export async function screenSanctions(input: SanctionsInput, c: SanctionsClients): Promise<SanctionsResult> {
  const { subjectName, equasisId, country, linkedCompanies, ownership, fleetImos } = input

  // Company targets, each labelled with its stable graph node id.
  const companyTargets: CompanyScreenTarget[] = [
    { label: subjectNodeId(equasisId, subjectName), name: subjectName, country: country ?? undefined },
    ...linkedCompanies.map((lc): CompanyScreenTarget => ({ label: companyNodeId(lc.companyImo, lc.name), name: lc.name })),
  ]
  if (ownership?.directParent) {
    companyTargets.push({ label: parentNodeId(ownership.directParent.lei), name: ownership.directParent.legalName })
  }
  if (ownership?.ultimateParent && ownership.ultimateParent.lei !== ownership.directParent?.lei) {
    companyTargets.push({ label: parentNodeId(ownership.ultimateParent.lei), name: ownership.ultimateParent.legalName })
  }
  // Dedup by node id (a company can appear as both linked + parent).
  const seenLabels = new Set<string>()
  const dedupedCompanies = companyTargets.filter((t) => (t.label && !seenLabels.has(t.label) ? (seenLabels.add(t.label), true) : false))

  const results: ScreeningResult[] = []
  // One batched call for all companies.
  const companyScreen = await c.opensanctions.screenCounterparty({ companies: dedupedCompanies })
  results.push(...companyScreen.results)

  // Fleet vessels screened by IMO (identifier tier), capped. screenCounterparty
  // takes a single vessel, so one call per IMO — labelled with the vessel node id.
  for (const imo of fleetImos.slice(0, MAX_VESSELS_SCREENED)) {
    const r = await c.opensanctions.screenCounterparty({ vessel: { imo } })
    for (const res of r.results) {
      if (res.kind === "vessel") results.push({ ...res, label: vesselNodeId(imo) })
    }
  }

  // Map matches → SanctionMatch[] (dedup by entity id) + per-node worst category.
  const seenIds = new Set<string>()
  const matches: SanctionMatch[] = []
  const nodeCategories: NodeCategories = {}

  for (const result of results) {
    const tier: 1 | 3 = result.decision === "hit" ? 1 : 3
    let worst: SanctionCategory | null = null
    for (const m of result.matches) {
      const category = m.category ?? classifyCategory(m.topics)
      if (!worst || CATEGORY_RANK[category] > CATEGORY_RANK[worst]) worst = category
      if (seenIds.has(m.id)) continue
      seenIds.add(m.id)
      matches.push({
        entity: m.caption,
        list: m.datasets[0] ?? "unknown",
        datasets: m.datasets,
        topics: m.topics,
        category,
        matchField: tier === 1 ? "imo" : "name",
        score: m.score,
        tier,
        firstSeen: m.firstSeen ?? null,
        lastSeen: m.lastSeen ?? null,
        lastChange: m.lastChange ?? null,
      })
    }
    // Colour the node only for a real signal (skip pure "other" noise).
    if (result.label && worst && worst !== "other") {
      const prev = nodeCategories[result.label]
      if (!prev || CATEGORY_RANK[worst] > CATEGORY_RANK[prev.category]) {
        nodeCategories[result.label] = { sanctioned: worst === "sanctioned", category: worst }
      }
    }
  }

  const hasDirectHit = results.some(
    (r) => r.decision === "hit" && r.matches.some((m) => m.isMatch && (m.category ?? classifyCategory(m.topics)) === "sanctioned"),
  )
  const hasRisk = results.some((r) => r.decision === "hit" || r.decision === "review")
  const status: SanctionsStatus = hasDirectHit ? "CONFIRMED" : hasRisk ? "POSSIBLE" : "NO_MATCH"

  return { status, matches, nodeCategories }
}
