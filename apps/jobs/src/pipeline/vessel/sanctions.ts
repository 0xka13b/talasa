import type { SanctionSeverity, VesselIdentity, VesselSanctionMatch } from "@talasa/shared"
import { strongestSeverity } from "@talasa/shared"
import { classifyCategory } from "@talasa/opensanctions"
import type { OpenSanctionsClient, ScreenTarget, ScreeningResult } from "@talasa/opensanctions"
import type { ManagementCompany, SisterVessel } from "./types"
import type { EnrichedCompany } from "./enrich"

type SanctionsClients = Pick<{ opensanctions: OpenSanctionsClient }, "opensanctions">

export interface VesselSanctionsResult {
  status: "NO_MATCH" | "POSSIBLE" | "CONFIRMED"
  subjectHit: boolean
  managementHit: boolean
  subjectReviewMatch: boolean
  /** Subject vessel is an OpenSanctions person/entity of interest (topic `poi`). */
  subjectPoi: boolean
  /** Severity of the sanction on the subject / management chain / parent owner. */
  subjectSeverity: SanctionSeverity
  managementSeverity: SanctionSeverity
  parentSeverity: SanctionSeverity
  /** Sister-vessel hits split by whether the sister is designated or merely linked. */
  directSisterCount: number
  linkedSisterCount: number
  companyHits: string[]
  sisterHits: { imo: string; name: string | null }[]
  parentHits: { lei: string; name: string; subsidiaryKey: string }[]
  matches: VesselSanctionMatch[]
  unavailable: boolean
}

const CHUNK = 25

/**
 * Severity of a screening result from its matches' topics: `direct` if any scored
 * match is itself designated, else `linked` if any is only sanction-linked, else
 * null. Derived from topics (not the stored `category`) so it holds even for a
 * result built outside the normal mapping path.
 */
function severityOf(result: ScreeningResult): SanctionSeverity {
  let linked = false
  for (const m of result.matches) {
    if (!m.isMatch) continue
    const category = classifyCategory(m.topics)
    if (category === "sanctioned") return "direct"
    if (category === "sanction_linked") linked = true
  }
  return linked ? "linked" : null
}

/** Whether a result carries a person/entity-of-interest or PEP note (not a formal
 * sanction, but important evidence — e.g. a shadow-fleet POI vessel). */
function poiOf(result: ScreeningResult): boolean {
  return result.matches.some((m) => m.isMatch && (classifyCategory(m.topics) === "poi" || classifyCategory(m.topics) === "pep"))
}

export async function screenVesselSanctions(
  identity: VesselIdentity,
  companies: ManagementCompany[],
  sisters: SisterVessel[],
  c: SanctionsClients,
  enriched: EnrichedCompany[] = [],
): Promise<VesselSanctionsResult> {
  const targets: ScreenTarget[] = []
  const nodeIds: string[] = []

  targets.push({ kind: "vessel", imo: identity.imo, name: identity.name ?? undefined, flag: identity.flag ?? undefined })
  nodeIds.push(`imo:${identity.imo}`)

  for (const s of sisters) {
    targets.push({ kind: "vessel", imo: s.imo, name: s.name ?? undefined, flag: s.flag ?? undefined })
    nodeIds.push(`imo:${s.imo}`)
  }
  for (const co of companies) {
    targets.push({ kind: "company", name: co.name })
    nodeIds.push(co.companyImo ? `company:${co.companyImo}` : `company:${co.name}`)
  }

  // Re-screen exact-matched companies under their GLEIF legal name (folds into
  // the same company nodeId → a hit is a normal management hit).
  for (const e of enriched) {
    const company = companies.find((co) => (co.companyImo ?? co.name) === e.key)
    if (!company) continue
    if (e.legalName && e.legalName.toLowerCase() !== company.name.toLowerCase()) {
      targets.push({ kind: "company", name: e.legalName, country: e.jurisdiction ?? undefined })
      nodeIds.push(company.companyImo ? `company:${company.companyImo}` : `company:${company.name}`)
    }
  }

  // Screen direct + ultimate parents (deduped by parent nodeId). A hit here is a
  // parentHit only — never a management/BLOCK trigger.
  const parentTargets: { e: EnrichedCompany; lei: string; name: string; nodeId: string }[] = []
  const seenParent = new Set<string>()
  for (const e of enriched) {
    for (const p of [e.directParent, e.ultimateParent]) {
      if (!p || seenParent.has(p.nodeId)) continue
      seenParent.add(p.nodeId)
      parentTargets.push({ e, lei: p.lei, name: p.legalName, nodeId: p.nodeId })
      targets.push({ kind: "company", name: p.legalName, country: p.jurisdiction ?? undefined })
      nodeIds.push(p.nodeId)
    }
  }

  // Screen in chunks; preserve target order so nodeIds line up.
  const results: ScreeningResult[] = []
  for (let i = 0; i < targets.length; i += CHUNK) {
    const slice = await c.opensanctions.screen(targets.slice(i, i + CHUNK))
    results.push(...slice)
  }

  const subjectResult = results[0]
  const sisterResults = results.slice(1, 1 + sisters.length)

  // Strongest severity per node id, across the Equasis-name AND GLEIF legal-name
  // targets that share a `company:${imo|name}` node (direct beats linked).
  const nodeSeverity = new Map<string, SanctionSeverity>()
  results.forEach((r, i) => {
    const severity = severityOf(r)
    if (!severity) return
    const nodeId = nodeIds[i]!
    nodeSeverity.set(nodeId, strongestSeverity(nodeSeverity.get(nodeId) ?? null, severity))
  })
  const companyNodeId = (co: ManagementCompany) => (co.companyImo ? `company:${co.companyImo}` : `company:${co.name}`)
  const sevAt = (nodeId: string): SanctionSeverity => nodeSeverity.get(nodeId) ?? null

  // Subject vessel: identifier ("hit") vs name-only ("review"); severity from topics.
  const subjectSeverity: SanctionSeverity = subjectResult?.decision === "hit" ? severityOf(subjectResult) : null
  const subjectHit = subjectSeverity !== null
  const subjectReviewMatch = subjectResult?.decision === "review"
  // A pure POI subject decides "clear" (poi isn't a sanction topic) — capture it
  // separately so it still drives status/scoring and isn't silently dropped.
  const subjectPoi = subjectResult ? poiOf(subjectResult) : false

  // Management: strongest severity across the owner/manager company nodes.
  let managementSeverity: SanctionSeverity = null
  for (const co of companies) managementSeverity = strongestSeverity(managementSeverity, sevAt(companyNodeId(co)))
  const managementHit = managementSeverity !== null
  const companyHits = companies.filter((co) => sevAt(companyNodeId(co)) !== null).map((co) => co.name)

  // Sisters: split designated vs merely linked.
  const sisterSeverities = sisterResults.map((r, i) => ({ s: sisters[i]!, severity: severityOf(r) }))
  const sisterHits = sisterSeverities.filter(({ severity }) => severity !== null).map(({ s }) => ({ imo: s.imo, name: s.name }))
  const directSisterCount = sisterSeverities.filter(({ severity }) => severity === "direct").length
  const linkedSisterCount = sisterSeverities.filter(({ severity }) => severity === "linked").length

  // Parents: individual hits for signals, plus the strongest severity for scoring.
  const parentHits = parentTargets
    .filter((pt) => sevAt(pt.nodeId) !== null)
    .map((pt) => ({ lei: pt.lei, name: pt.name, subsidiaryKey: pt.e.key }))
  let parentSeverity: SanctionSeverity = null
  for (const pt of parentTargets) parentSeverity = strongestSeverity(parentSeverity, sevAt(pt.nodeId))

  // Flatten matches with their node id, deduped by (nodeId, entity id).
  const matches: VesselSanctionMatch[] = []
  const seen = new Set<string>()
  results.forEach((result, i) => {
    const nodeId = nodeIds[i]!
    const tier = result.decision === "hit" ? "hit" : "review"
    for (const m of result.matches) {
      // Keep every meaningful match — a formal sanction/link OR a PEP/POI note.
      // POI ("person of interest", e.g. a shadow-fleet vessel) is not a sanction
      // topic but is important evidence, so it must not be dropped.
      if (!(m.isMatch && m.category !== "other")) continue
      const key = `${nodeId}:${m.id}`
      if (seen.has(key)) continue
      seen.add(key)
      matches.push({
        entity: m.caption,
        list: m.datasets[0] ?? "unknown",
        datasets: m.datasets,
        topics: m.topics,
        category: m.category,
        description: m.description ?? null,
        notes: m.notes,
        matchField: result.kind === "vessel" ? "imo" : "name",
        score: m.score,
        tier,
        nodeId,
        firstSeen: m.firstSeen ?? null,
        lastSeen: m.lastSeen ?? null,
        lastChange: m.lastChange ?? null,
      })
    }
  })

  // CONFIRMED is reserved for a *direct* designation on the subject or its
  // management chain. Everything else that carries a sanctions signal — a link,
  // a sanctioned sister, a parent hit, or a name-only match — is POSSIBLE.
  const status: VesselSanctionsResult["status"] =
    subjectSeverity === "direct" || managementSeverity === "direct" ? "CONFIRMED"
    : subjectHit || managementHit || sisterHits.length > 0 || parentSeverity !== null || subjectReviewMatch || subjectPoi ? "POSSIBLE"
    : "NO_MATCH"

  return {
    status, subjectHit, managementHit, subjectReviewMatch, subjectPoi,
    subjectSeverity, managementSeverity, parentSeverity, directSisterCount, linkedSisterCount,
    companyHits, sisterHits, parentHits, matches, unavailable: false,
  }
}
