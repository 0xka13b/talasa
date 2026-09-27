import type {
  DDEvidence,
  Brief,
  BriefLLMFields,
  EntityGraph,
  LinkedCompany,
  ResolvedEntity,
  CompanyOwnership,
} from "@talasa/shared"
import { computeRiskScore, decideAction } from "@talasa/shared"
import type { InferenceClient, Usage } from "@talasa/inference"
import type { CaseInput } from "./types"
import type { NetworkResult } from "./network"
import type { SanctionsResult } from "./sanctions"
import { buildCompanyGraph, companyNodeId } from "./graph"

type SynthesizeClients = Pick<{ inference: InferenceClient }, "inference">

/** Whether GLEIF resolved enough to consider beneficial ownership known. */
function beneficialOwnerResolved(ownership: CompanyOwnership | null): boolean {
  if (!ownership) return false
  // Ultimate parent found → known. Or an LEI with no parent → the entity is the top.
  return ownership.ultimateParent != null || (ownership.lei != null && ownership.directParent == null)
}

/**
 * Assemble deterministic evidence from all upstream stage outputs. Pure — no I/O.
 * Computes riskScore + decision via the deterministic scoring layer; the LLM
 * never sets these. Linked companies are annotated with their sanction category
 * from the sanctions stage so the evidence and the graph agree.
 */
export function assembleEvidence(
  input: CaseInput,
  resolved: ResolvedEntity,
  network: NetworkResult,
  ownership: CompanyOwnership | null,
  sanctions: SanctionsResult,
  failedStages: string[],
): DDEvidence {
  const canonicalName = network.companyProfile.name || resolved.canonicalName

  // Annotate linked companies with their sanction category (from node colouring).
  const linkedCompanies: LinkedCompany[] = network.linkedCompanies.map((lc) => {
    const cat = sanctions.nodeCategories[companyNodeId(lc.companyImo, lc.name)]
    return cat ? { ...lc, sanctioned: cat.sanctioned, category: cat.category } : lc
  })

  const unresolvedBeneficialOwner = !beneficialOwnerResolved(ownership)

  // Data-completeness ledger: honest holes, not always-on placeholders.
  const gaps = [
    ...(unresolvedBeneficialOwner ? ["beneficial_owner"] : []),
    ...(ownership ? [] : ["corporate_ownership"]),
    ...(network.fleet.length === 0 ? ["fleet"] : []),
    ...(network.truncated ? ["fleet_truncated"] : []),
    ...failedStages,
  ]
  const uniqueGaps = [...new Set(gaps)]

  const sourcesOk: string[] = []
  if (!failedStages.includes("resolve")) sourcesOk.push("equasis_resolve")
  if (!failedStages.includes("network")) sourcesOk.push("equasis_network")
  if (!failedStages.includes("ownership") && ownership) sourcesOk.push("gleif")
  if (!failedStages.includes("sanctions")) sourcesOk.push("opensanctions")

  const riskScore = computeRiskScore({
    sanctionsStatus: sanctions.status,
    sanctionMatchCount: sanctions.matches.length,
    detentionCount: network.detentions.length,
    unresolvedBeneficialOwner,
  })
  const decision = decideAction(riskScore, sanctions.status)

  return {
    counterparty: {
      queryName: input.queryName,
      canonicalName,
      aliases: resolved.aliases,
      country: network.companyProfile.country ?? resolved.country,
      role: input.role,
      resolutionConfidence: resolved.confidence,
      equasisCompanyId: resolved.equasisCompanyId,
    },
    companyProfile: network.companyProfile,
    fleet: network.fleet,
    linkedCompanies,
    affiliations: network.affiliations,
    ownership,
    sanctions: { status: sanctions.status, matches: sanctions.matches },
    incidents: { detentions: network.detentions, gaps: uniqueGaps },
    dataCompleteness: { sourcesOk, gaps: uniqueGaps },
    riskScore,
    decision,
  }
}

/**
 * Synthesize stage: assemble deterministic evidence, build the relationship
 * graph, make ONE LLM call for narratives, and merge. The riskScore.band /
 * recommendedAction.decision are ALWAYS the deterministic values — the LLM
 * cannot override them.
 */
export async function synthesize(
  input: CaseInput,
  resolved: ResolvedEntity,
  network: NetworkResult,
  ownership: CompanyOwnership | null,
  sanctions: SanctionsResult,
  c: SynthesizeClients,
  failedStages: string[] = [],
  caseId?: string,
): Promise<{ brief: Brief; usage: Usage }> {
  const evidence = assembleEvidence(input, resolved, network, ownership, sanctions, failedStages)

  const graph = buildCompanyGraph({
    equasisId: resolved.equasisCompanyId,
    subjectName: evidence.counterparty.canonicalName,
    companyProfile: evidence.companyProfile,
    fleet: evidence.fleet,
    linkedCompanies: evidence.linkedCompanies,
    ownership,
    nodeCategories: sanctions.nodeCategories,
  })

  const { fields, usage } = await c.inference.synthesizeBrief(evidence)
  const brief = mergeBrief(evidence, graph, fields, usage, caseId)
  return { brief, usage }
}

// ---------------------------------------------------------------------------
// Merge — deterministic D-fields + LLM narrative L-fields → Brief
// ---------------------------------------------------------------------------

function mergeBrief(evidence: DDEvidence, graph: EntityGraph, fields: BriefLLMFields, usage: Usage, caseId?: string): Brief {
  const now = new Date().toISOString()
  return {
    caseId: caseId ?? `dd_${now.slice(0, 10).replace(/-/g, "")}_${slugify(evidence.counterparty.canonicalName)}`,
    generatedAt: now,
    reportVersion: "1.0",
    dataCompleteness: evidence.dataCompleteness,
    counterparty: evidence.counterparty,
    companyProfile: evidence.companyProfile,
    fleet: evidence.fleet,
    linkedCompanies: evidence.linkedCompanies,
    ownership: evidence.ownership,
    ownershipNarrative: fields.ownershipNarrative,
    graph,
    // Legacy affiliations block — data D + narrative L (superseded by `graph`).
    affiliations: { nodes: evidence.affiliations.nodes, edges: evidence.affiliations.edges, narrative: fields.affiliationsNarrative },
    sanctions: { status: evidence.sanctions.status, matches: evidence.sanctions.matches, narrative: fields.sanctionsNarrative },
    incidents: evidence.incidents,
    // riskScore / recommendedAction: deterministic value + LLM justification only.
    riskScore: { value: evidence.riskScore.value, band: evidence.riskScore.band, drivers: evidence.riskScore.drivers, justification: fields.riskJustification },
    recommendedAction: { decision: evidence.decision, rationale: fields.recommendedActionRationale },
    executiveSummary: fields.executiveSummary,
    modelMeta: { model: usage.model, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, cachedTokens: usage.cachedTokens },
  }
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 31)
    .replace(/-+$/g, "")
}
