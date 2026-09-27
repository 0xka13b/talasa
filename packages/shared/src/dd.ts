import { z } from "zod"

// Company-centric screening: resolve the counterparty → map its fleet & the
// companies linked through it (the relationship network, incl. each affiliate's
// own fleet) → GLEIF corporate ownership → sanctions over the whole network →
// synthesize.
export const STAGE_NAMES = ["resolve", "network", "ownership", "sanctions", "synthesize"] as const
export type StageName = (typeof STAGE_NAMES)[number]
export type StageStatus = "pending" | "running" | "done" | "failed"

export interface StageRecord {
  status: StageStatus
  attempts: number
  startedAt?: string
  finishedAt?: string
  durationMs?: number
  error?: string | null
  /** Parsed source output — the re-run snapshot. */
  output?: unknown
}
export type StageMap = Partial<Record<StageName, StageRecord>>

export interface ResolvedEntity {
  canonicalName: string
  aliases: string[]
  country: string | null
  /** Registered address, when known at resolve time (e.g. carried from the picked
   * Equasis search result). Used as the company-profile address fallback. */
  address: string | null
  equasisCompanyId: string | null
  fleetImos: string[]
  sanctionsEntityId: string | null
  confidence: number
}

/** One vessel in a fleet listing (subject's or an affiliate's). owner/manager are
 * null on vessels we only listed (affiliates) rather than opened the ship page for. */
export const fleetVesselSchema = z.object({
  imo: z.string(),
  name: z.string().nullable(),
  flag: z.string().nullable(),
  type: z.string().nullable(),
  registeredOwner: z.string().nullable(),
  manager: z.string().nullable(),
})
export type FleetVessel = z.infer<typeof fleetVesselSchema>
export interface AffiliationGraph { nodes: { name: string; role: string; country: string | null }[]; edges: { from: string; to: string; via: string }[] }

/**
 * How a match relates to sanctions (mirrors the opensanctions package). Lets a
 * report distinguish a party that is *itself* designated (`sanctioned`) from one
 * merely *linked* to a sanctioned entity (`sanction_linked`, e.g. the manager of
 * a sanctioned vessel) — instead of labelling both "sanctioned".
 */
export const SANCTION_CATEGORIES = ["sanctioned", "sanction_linked", "pep", "poi", "other"] as const
export type SanctionCategory = (typeof SANCTION_CATEGORIES)[number]
export const sanctionCategoryEnum = z.enum(SANCTION_CATEGORIES)

// ---- relationship graph (shared by vessel screening AND counterparty DD) ----
// One node/edge vocabulary so the same interactive graph board renders a vessel's
// ownership chain and a company's corporate/fleet network. A company subject is a
// `legal` node with `isSubject`; its fleet are `vessel` nodes; linked companies
// and GLEIF parents are further `legal` nodes.
export const graphNodeSchema = z.object({
  id: z.string(),
  kind: z.enum(["vessel", "legal"]),
  label: z.string(),
  sub: z.string().nullish(),
  sanctioned: z.boolean().default(false),
  /** Worst sanction category among matches on this node — drives the graph's
   * node colour with the SAME vocabulary as the sanctions tabs (direct = red,
   * linked / PEP / POI = amber). Absent on nodes with no match / older graphs. */
  category: sanctionCategoryEnum.nullish(),
  isSubject: z.boolean().default(false),
  data: z.record(z.string(), z.unknown()),
})
export type GraphNode = z.infer<typeof graphNodeSchema>

export const graphEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  rel: z.enum(["registered_owner", "ism_manager", "commercial_manager", "manager", "parent", "ultimate_parent"]),
})
export type GraphEdge = z.infer<typeof graphEdgeSchema>

export const entityGraphSchema = z.object({
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
})
export type EntityGraph = z.infer<typeof entityGraphSchema>

// ---- company network (Equasis + GLEIF) ----

/** The subject counterparty's own Equasis company record. */
export const companyProfileSchema = z.object({
  equasisId: z.string().nullable(),
  name: z.string(),
  address: z.string().nullable(),
  country: z.string().nullable(),
  /** Number of vessels enumerated for this company. */
  fleetCount: z.number(),
})
export type CompanyProfile = z.infer<typeof companyProfileSchema>

/**
 * A company connected to the subject through one or more shared vessels — a
 * co-owner / co-manager surfaced by traversing the subject's fleet's management
 * chains. This is the raw material of the corporate network. For the closest
 * affiliates we go a level deeper and enumerate their OWN fleet (`fleet` +
 * `fleetCount`), so the relationship picture spans the subject AND its network.
 */
export const linkedCompanySchema = z.object({
  companyImo: z.string().nullable(),
  name: z.string(),
  /** Distinct roles this company plays across the shared vessels (e.g. "ISM Manager"). */
  roles: z.array(z.string()),
  /** IMOs of the vessels connecting this company to the subject. */
  sharedVesselImos: z.array(z.string()),
  sanctioned: z.boolean().default(false),
  category: sanctionCategoryEnum.nullish(),
  /** The affiliate's registered address, from its Equasis management entry. */
  address: z.string().nullish(),
  /** Total vessels in the affiliate's own fleet (0 when not expanded / unknown). */
  fleetCount: z.number().default(0),
  /** A capped sample of the affiliate's own fleet (its relationship reach). */
  fleet: z.array(fleetVesselSchema).default([]),
})
export type LinkedCompany = z.infer<typeof linkedCompanySchema>

const ownershipParentSchema = z.object({
  lei: z.string(),
  legalName: z.string(),
  jurisdiction: z.string().nullable(),
})

/** GLEIF corporate-ownership record for the subject (LEI + consolidating parents). */
export const companyOwnershipSchema = z.object({
  lei: z.string().nullable(),
  legalName: z.string().nullable(),
  jurisdiction: z.string().nullable(),
  registrationStatus: z.string().nullable(),
  matchConfidence: z.enum(["exact", "fuzzy"]).nullable(),
  directParent: ownershipParentSchema.nullable(),
  ultimateParent: ownershipParentSchema.nullable(),
})
export type CompanyOwnership = z.infer<typeof companyOwnershipSchema>

export interface SanctionMatch {
  entity: string
  /** First (primary) source list — kept for back-compat; see `datasets` for the full set. */
  list: string
  matchField: string
  score: number
  tier: 1 | 3
  /** All source lists the entity appears on, e.g. `["us_ofac_sdn", "eu_fsf"]`. */
  datasets?: string[]
  /** Raw OpenSanctions topics (`sanction`, `sanction.linked`, `role.pep`, …). */
  topics?: string[]
  /** Direct-vs-linked-vs-PEP classification derived from `topics`. */
  category?: SanctionCategory
  /** Designation lifecycle timestamps from OpenSanctions. */
  firstSeen?: string | null
  lastSeen?: string | null
  lastChange?: string | null
}
export interface Detention { imo: string; authority: string | null; date: string | null; detail: string | null }

export const RISK_BANDS = ["CLEAR", "ENHANCED_DD", "REJECT"] as const
export type RiskBand = (typeof RISK_BANDS)[number]
export type Decision = RiskBand
export interface RiskScore { value: number; band: RiskBand; drivers: string[] }

/** Deterministic evidence assembled before the single LLM call. */
export interface DDEvidence {
  counterparty: { queryName: string; canonicalName: string; aliases: string[]; country: string | null; role: string | null; resolutionConfidence: number; equasisCompanyId: string | null }
  companyProfile: CompanyProfile | null
  fleet: FleetVessel[]
  /** Companies linked to the subject through shared vessels (the corporate network). */
  linkedCompanies: LinkedCompany[]
  /** Legacy flat affiliation graph — superseded by `graph`, kept for the brief's back-compat. */
  affiliations: AffiliationGraph
  /** GLEIF corporate ownership (LEI + parents), or null when unresolved. */
  ownership: CompanyOwnership | null
  sanctions: { status: "NO_MATCH" | "POSSIBLE" | "CONFIRMED"; matches: SanctionMatch[] }
  incidents: { detentions: Detention[]; gaps: string[] }
  dataCompleteness: { sourcesOk: string[]; gaps: string[] }
  riskScore: RiskScore
  decision: Decision
}

/** The LLM-authored fields (and only these). */
export interface BriefLLMFields {
  executiveSummary: string
  /** Narrative over the corporate/fleet relationship network. */
  affiliationsNarrative: string
  /** Narrative over GLEIF corporate ownership (LEI, parents, jurisdiction). */
  ownershipNarrative: string
  sanctionsNarrative: string
  riskJustification: string
  recommendedActionRationale: string
}

const riskBand = z.enum(RISK_BANDS)

export const briefSchema = z.object({
  caseId: z.string(),
  generatedAt: z.string(),
  reportVersion: z.string(),
  dataCompleteness: z.object({ sourcesOk: z.array(z.string()), gaps: z.array(z.string()) }),
  counterparty: z.object({
    queryName: z.string(), canonicalName: z.string(), aliases: z.array(z.string()),
    country: z.string().nullable(), resolutionConfidence: z.number(), equasisCompanyId: z.string().nullable(),
    // Back-compat: absent on briefs written before the company-centric rework.
    role: z.string().nullish(),
  }),
  // The subject company's Equasis record. Nullish for back-compat.
  companyProfile: companyProfileSchema.nullish(),
  fleet: z.array(fleetVesselSchema),
  // Corporate network (companies sharing vessels with the subject). Defaults empty.
  linkedCompanies: z.array(linkedCompanySchema).default([]),
  // GLEIF corporate ownership + its narrative. Nullish for back-compat.
  ownership: companyOwnershipSchema.nullish(),
  ownershipNarrative: z.string().nullish(),
  // The interactive relationship graph (subject → fleet → linked companies → parents).
  graph: entityGraphSchema.nullish(),
  affiliations: z.object({
    nodes: z.array(z.object({ name: z.string(), role: z.string(), country: z.string().nullable() })),
    edges: z.array(z.object({ from: z.string(), to: z.string(), via: z.string() })),
    narrative: z.string(),
  }),
  sanctions: z.object({
    status: z.enum(["NO_MATCH", "POSSIBLE", "CONFIRMED"]),
    // New fields are optional so briefs written before this change still parse.
    matches: z.array(z.object({
      entity: z.string(),
      list: z.string(),
      matchField: z.string(),
      score: z.number(),
      tier: z.union([z.literal(1), z.literal(3)]),
      datasets: z.array(z.string()).optional(),
      topics: z.array(z.string()).optional(),
      category: sanctionCategoryEnum.optional(),
      firstSeen: z.string().nullish(),
      lastSeen: z.string().nullish(),
      lastChange: z.string().nullish(),
    })),
    narrative: z.string(),
  }),
  incidents: z.object({
    detentions: z.array(z.object({ imo: z.string(), authority: z.string().nullable(), date: z.string().nullable(), detail: z.string().nullable() })),
    gaps: z.array(z.string()),
  }),
  riskScore: z.object({ value: z.number(), band: riskBand, drivers: z.array(z.string()), justification: z.string() }),
  recommendedAction: z.object({ decision: riskBand, rationale: z.string() }),
  executiveSummary: z.string(),
  modelMeta: z.object({ model: z.string(), inputTokens: z.number(), outputTokens: z.number(), cachedTokens: z.number() }).nullable(),
})
export type Brief = z.infer<typeof briefSchema>

export function slugify(value: string): string {
  return value
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 31).replace(/-+$/g, "")
}

export function caseRef(counterpartyName: string, createdAt: Date, id: string): string {
  const date = createdAt.toISOString().slice(0, 10).replace(/-/g, "")
  return `dd_${date}_${slugify(counterpartyName)}_${id.slice(0, 8)}`
}
