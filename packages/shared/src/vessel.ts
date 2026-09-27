import { z } from "zod"
import { projectStatusSchema, stageRecordSchema, progressSchema } from "./project.js"
import { sanctionCategoryEnum } from "./dd.js"

export const VESSEL_STAGE_NAMES = ["identify", "history", "inspections", "fleet", "enrich", "sanctions", "ownership", "ais", "synthesize"] as const
export type VesselStageName = (typeof VESSEL_STAGE_NAMES)[number]

export const VESSEL_VERDICTS = ["PROCEED", "CAUTION", "BLOCK"] as const
export type VesselVerdict = (typeof VESSEL_VERDICTS)[number]
const vesselVerdictEnum = z.enum(VESSEL_VERDICTS)

// ---- create input. `name` is an OPTIONAL user-supplied label (recognizable from
// their own memory); left blank it is backfilled with the resolved vessel name by
// the identify stage. `imo` identifies the vessel for Equasis + sanctions lookups. ----
export const createScreeningSchema = z.object({
  name: z.string().trim().max(200).optional(),
  imo: z.string().regex(/^\d{7}$/, "IMO must be 7 digits"),
})
export type CreateScreeningInput = z.infer<typeof createScreeningSchema>

// ---- identity ----
export const vesselIdentitySchema = z.object({
  imo: z.string(),
  name: z.string().nullable(),
  flag: z.string().nullable(),
  type: z.string().nullable(),
  grossTonnage: z.number().nullable(),
  deadweight: z.number().nullable(),
  yearBuilt: z.string().nullable(),
  classSociety: z.string().nullable(),
  mmsi: z.string().nullable(),
  callSign: z.string().nullable(),
  status: z.string().nullable(),
  riskyFlag: z.boolean(),
  detentionRate: z.string().nullable(),
  parisMou: z.string().nullable(),
  tokyoMou: z.string().nullable(),
})
export type VesselIdentity = z.infer<typeof vesselIdentitySchema>

// ---- ship history (name / flag / class / company-role changes over time) ----
// Sourced from Equasis ShipHistory. Surfaces shadow-fleet indicators such as
// flag-hopping and re-naming that a point-in-time identity snapshot hides.
export const vesselHistoryChangeSchema = z.object({
  /** "name" | "flag" | "class" | a company role (e.g. "Registered owner"). */
  kind: z.string(),
  /** The value that took effect — ship name, flag state, society, or company. */
  value: z.string().nullable(),
  /** Date the value became effective (DD/MM/YYYY), or null. */
  from: z.string().nullable(),
  /** Suspect-country flag change (e.g. switched to a Russian flag on/after 2022).
   * Added when the brief is assembled; absent on the raw fetch. */
  suspect: z.boolean().optional(),
  suspectLabel: z.string().nullable().optional(),
})
export type VesselHistoryChange = z.infer<typeof vesselHistoryChangeSchema>

export const vesselHistorySchema = z.object({
  /** Distinct flag states the vessel has flown, in the order Equasis lists them. */
  flags: z.array(z.string()),
  /** Distinct names the vessel has carried, in the order Equasis lists them. */
  names: z.array(z.string()),
  /** Flag switches on record (distinct flags − 1, floored at 0). */
  flagChanges: z.number(),
  /** Re-namings on record (distinct names − 1, floored at 0). */
  nameChanges: z.number(),
  /** Every parsed change row (name / flag / class / company-role). */
  entries: z.array(vesselHistoryChangeSchema),
})
export type VesselHistory = z.infer<typeof vesselHistorySchema>

// ---- port-state-control inspections ----
// Sourced from Equasis ShipInspection — the per-report detail behind the
// header detention-rate summary that lives on VesselIdentity.
export const vesselInspectionSchema = z.object({
  /** Inspecting authority / country (e.g. "Romania"), or null on older rows. */
  authority: z.string().nullable(),
  /** Date of report as Equasis renders it (DD/MM/YYYY), or null. */
  date: z.string().nullable(),
  /** Port of inspection, or null. */
  port: z.string().nullable(),
  /** Whether the inspection led to a detention. */
  detained: z.boolean(),
  /** Number of deficiencies recorded, or null when none reported. */
  deficiencies: z.number().nullable(),
  /** Inspection by a suspect-country PSC authority (e.g. Russia on/after 2022).
   * Added when the brief is assembled; absent on the raw fetch. */
  suspect: z.boolean().optional(),
  suspectLabel: z.string().nullable().optional(),
})
export type VesselInspection = z.infer<typeof vesselInspectionSchema>

export const vesselInspectionsSchema = z.object({
  /** Inspection reports on record. */
  total: z.number(),
  /** How many of those reports led to a detention. */
  detentions: z.number(),
  /** Total deficiencies summed across all reports. */
  deficiencies: z.number(),
  /** Every inspection report, in the order Equasis lists them (most recent first). */
  records: z.array(vesselInspectionSchema),
})
export type VesselInspections = z.infer<typeof vesselInspectionsSchema>

// ---- geographic movements ----
// Sourced from the Equasis ShipInfo "Geographical information" table — coarse
// sighting areas over time. Suspect visits (e.g. Russia on/after 2022) are
// flagged via the shared suspect-country registry.
export const vesselGeographyEntrySchema = z.object({
  /** Date of record (coarse, e.g. "June 2026"). */
  date: z.string().nullable(),
  /** Area where the ship was seen (one or more comma-separated zones). */
  area: z.string().nullable(),
  /** Reporting source (e.g. "MarineTraffic"). */
  source: z.string().nullable(),
  suspect: z.boolean().default(false),
  suspectLabel: z.string().nullable().default(null),
})
export type VesselGeographyEntry = z.infer<typeof vesselGeographyEntrySchema>

// ---- graph ----
// The entity-graph schema (graphNodeSchema / graphEdgeSchema / entityGraphSchema)
// now lives in ./dd.ts so both vessel screening and counterparty DD share ONE
// relationship-graph vocabulary. Re-exported from the package barrel, so external
// importers still `import { entityGraphSchema, EntityGraph } from "@talasa/shared"`.

// ---- relationship graph "board": the user's overlay on the entity graph ----
// Persists ONLY user state — manual node positions, free-form annotations, and
// the pan/zoom viewport — never the entity data itself (that is regenerated
// deterministically from the screening on every run). On load, saved positions
// override the computed layout for entities that still exist; stale ids are
// ignored; annotations are self-contained. Every field defaults, so an absent
// or older board still parses.
export const graphBoardAnnotationSchema = z.object({
  id: z.string(),
  /** `text` = a sticky note; `box` = a translucent grouping rectangle. */
  type: z.enum(["text", "box"]),
  position: z.object({ x: z.number(), y: z.number() }),
  width: z.number().default(180),
  height: z.number().default(80),
  data: z
    .object({
      text: z.string().default(""),
      /** Accent colour (hex), or null for the theme default. */
      color: z.string().nullable().default(null),
    })
    .default({ text: "", color: null }),
})
export type GraphBoardAnnotation = z.infer<typeof graphBoardAnnotationSchema>

/** A user-drawn connector between two board nodes (entities and/or annotations). */
export const graphBoardEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
})
export type GraphBoardEdge = z.infer<typeof graphBoardEdgeSchema>

export const graphBoardSchema = z.object({
  version: z.literal(1).default(1),
  viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number() }).nullable().default(null),
  /** entity nodeId → manual position override (drag). */
  positions: z.record(z.string(), z.object({ x: z.number(), y: z.number() })).default({}),
  annotations: z.array(graphBoardAnnotationSchema).default([]),
  /** User-drawn connectors (e.g. linking a note to an entity). */
  edges: z.array(graphBoardEdgeSchema).default([]),
})
export type GraphBoard = z.infer<typeof graphBoardSchema>

// ---- signals + sanction matches ----
export const vesselSignalSchema = z.object({
  kind: z.string(),
  severity: z.enum(["weak", "strong", "blocking"]),
  detail: z.string(),
})
export type VesselSignal = z.infer<typeof vesselSignalSchema>

export const vesselSanctionMatchSchema = z.object({
  entity: z.string(),
  list: z.string(),
  matchField: z.string(),
  score: z.number(),
  tier: z.enum(["hit", "review"]),
  nodeId: z.string(),
  // New fields are optional so briefs written before this change still parse.
  datasets: z.array(z.string()).optional(),
  topics: z.array(z.string()).optional(),
  category: sanctionCategoryEnum.optional(),
  /** Designation narrative (why the entity is listed / of interest) — e.g. a POI
   * vessel's shadow-fleet description. Important evidence; never dropped. */
  description: z.string().nullish(),
  /** Full FtM `notes` values, if any. */
  notes: z.array(z.string()).optional(),
  firstSeen: z.string().nullish(),
  lastSeen: z.string().nullish(),
  lastChange: z.string().nullish(),
})
export type VesselSanctionMatch = z.infer<typeof vesselSanctionMatchSchema>

// ---- undisclosed ownership + inferred network ----
// Equasis sometimes reports a management role with a placeholder in place of a
// real company — e.g. ISM Manager "UNKNOWN", or a registered/commercial manager
// "RPTD SOLD UNDISCLOSED INTEREST" (reported sold to an undisclosed interest).
// That deliberate opacity is itself a risk flag (a shadow-fleet concealment
// tactic). These placeholder rows carry no company IMO, so they never survive
// into `companies`; we capture them separately here.
export const undisclosedOwnershipFlagSchema = z.object({
  /** Canonical management role that came back undisclosed (e.g. "Commercial Manager"). */
  role: z.string(),
  /** The literal Equasis placeholder text (e.g. "RPTD SOLD UNDISCLOSED INTEREST"). */
  placeholder: z.string(),
})
export type UndisclosedOwnershipFlag = z.infer<typeof undisclosedOwnershipFlagSchema>

/** One candidate entity in an INFERRED ownership network (never a registry fact). */
export const inferredOwnerEntitySchema = z.object({
  /** Entity or individual name as it appears in the source narrative. */
  name: z.string(),
  /** Role as described in the evidence (e.g. "Prior manager 2022–2023", "Ultimate network principal"). */
  role: z.string(),
  /** Free-text signal-strength rationale (why this is a lead, and how strong). */
  signal: z.string(),
  /** Coarse confidence bucket, for sorting + colour. */
  strength: z.enum(["strong", "moderate", "weak"]),
})
export type InferredOwnerEntity = z.infer<typeof inferredOwnerEntitySchema>

/**
 * The optional inferred-ownership block. Present ONLY when Equasis returned an
 * undisclosed/unknown ownership placeholder. It NEVER overrides the registry
 * `companies` data — it is a separate, clearly-labelled investigative hypothesis
 * built by passing sanctions-list evidence through an inference call. `entities`
 * may be empty (placeholder flagged but nothing to infer, or inference skipped).
 */
export const inferredOwnershipSchema = z.object({
  /** The undisclosed-ownership placeholder(s) that triggered this block. */
  flags: z.array(undisclosedOwnershipFlagSchema).default([]),
  /** Candidate owners/operators inferred from the narrative evidence, strongest first. */
  entities: z.array(inferredOwnerEntitySchema).default([]),
  /** One-line framing of the inferred network (or why nothing could be inferred). */
  summary: z.string().default(""),
  generatedAt: z.string().nullish(),
})
export type InferredOwnership = z.infer<typeof inferredOwnershipSchema>

// ---- GLEIF parent ownership ----
export const gleifParentLinkSchema = z.object({
  lei: z.string(),
  legalName: z.string(),
  jurisdiction: z.string().nullable(),
})
export type GleifParentLink = z.infer<typeof gleifParentLinkSchema>

// ---- AIS behaviour summary (Datalastic track analysis, flattened for the brief) ----
/** Deterministic maritime location for an offshore event (no reverse geocoder). */
export const aisMaritimeSchema = z.object({
  nearestPort: z.string().nullable(),
  distanceNm: z.number().nullable(),
  bearing: z.string().nullable(),
  sea: z.string().nullable(),
  eez: z.string().nullable(),
})
export type AisMaritime = z.infer<typeof aisMaritimeSchema>

export const aisEventSchema = z.object({
  kind: z.enum(["dark_gap", "sts_candidate", "speed_anomaly"]),
  startUtc: z.string().nullable(),
  endUtc: z.string().nullable(),
  durationHours: z.number().nullable(),
  distanceNm: z.number().nullable(),
  impliedSpeedKn: z.number().nullable(),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  highRiskArea: z.string().nullable(),
  /**
   * Human place label reverse-geocoded from lat/lon (e.g. "Freetown, Sierra
   * Leone"). Null for open-water points Google can't resolve. `nullish` so briefs
   * written before geocoding existed still parse.
   */
  place: z.string().nullish(),
  /**
   * Deterministic maritime location (nearest port + bearing/distance, named sea,
   * approximate EEZ) — computed offline from bundled datasets, so it resolves the
   * open-water points reverse-geocoding leaves blank. `nullish` for back-compat.
   */
  maritime: aisMaritimeSchema.nullish(),
})
export type AisEvent = z.infer<typeof aisEventSchema>

export const aisBriefSchema = z.object({
  available: z.boolean(),
  positionCount: z.number(),
  spanDays: z.number(),
  darkGapCount: z.number(),
  stsCandidateCount: z.number(),
  speedAnomalyCount: z.number(),
  highRiskZoneActivity: z.boolean(),
  /** Notable events, most significant first (may be truncated — see `truncated`). */
  events: z.array(aisEventSchema),
  truncated: z.boolean(),
  summary: z.string(),
})
export type AisBrief = z.infer<typeof aisBriefSchema>

// ---- brief ----
export const vesselBriefSchema = z.object({
  screeningId: z.string(),
  imo: z.string(),
  generatedAt: z.string(),
  reportVersion: z.string(),
  identity: vesselIdentitySchema,
  // Optional + nullish so briefs generated before ship history / PSC detail
  // existed still parse.
  history: vesselHistorySchema.nullish(),
  inspections: vesselInspectionsSchema.nullish(),
  /** Recent geographic sightings (default [] so older briefs parse). */
  geography: z.array(vesselGeographyEntrySchema).default([]),
  companies: z.array(z.object({
    companyImo: z.string().nullable(),
    /** Primary (highest-priority) role, kept for back-compat + simple labels. */
    role: z.string(),
    /** All distinct roles this legal entity holds toward the subject (deduped). */
    roles: z.array(z.string()).default([]),
    name: z.string(),
    address: z.string().nullable(),
    /** True only for a DIRECT designation (category "sanctioned"). */
    sanctioned: z.boolean(),
    /** Worst sanction category on this entity — the single label source shared
     * with the overview/graph (direct/linked/PEP/POI). */
    category: sanctionCategoryEnum.nullish(),
    // GLEIF enrichment (present only for exact matches; all optional → old briefs parse)
    lei: z.string().nullish(),
    legalName: z.string().nullish(),
    jurisdiction: z.string().nullish(),
    registrationStatus: z.string().nullish(),
    directParent: gleifParentLinkSchema.nullish(),
    ultimateParent: gleifParentLinkSchema.nullish(),
    parentSanctioned: z.boolean().default(false),
  })),
  fleet: z.object({
    companies: z.array(z.object({
      companyImo: z.string().nullable(),
      name: z.string(),
      vesselCount: z.number(),
      sampledCount: z.number(),
      sanctionedCount: z.number(),
    })),
    sisters: z.array(z.object({
      imo: z.string(),
      name: z.string().nullable(),
      flag: z.string().nullable(),
      type: z.string().nullable(),
      /** True only for a DIRECT designation (category "sanctioned"). */
      sanctioned: z.boolean(),
      /** Worst sanction category on this sister (shared label vocabulary). */
      category: sanctionCategoryEnum.nullish(),
    })),
    truncated: z.boolean(),
    note: z.string().nullable(),
  }),
  sanctions: z.object({
    status: z.enum(["NO_MATCH", "POSSIBLE", "CONFIRMED"]),
    subjectHit: z.boolean(),
    companyHits: z.array(z.string()),
    sisterHits: z.array(z.object({ imo: z.string(), name: z.string().nullable() })),
    matches: z.array(vesselSanctionMatchSchema),
    narrative: z.string(),
  }),
  // Optional investigative overlay, populated only when registry ownership came
  // back undisclosed/unknown. Nullish so briefs without it still parse.
  inferredOwnership: inferredOwnershipSchema.nullish(),
  signals: z.array(vesselSignalSchema),
  verdict: z.object({
    decision: vesselVerdictEnum,
    score: z.number(),
    drivers: z.array(z.string()),
    justification: z.string(),
  }),
  // AIS behaviour (Datalastic). Nullish so briefs generated before AIS still parse.
  ais: aisBriefSchema.nullish(),
  executiveSummary: z.string(),
  prediction: z.string(),
  recommendation: z.string(),
  dataCompleteness: z.object({ sourcesOk: z.array(z.string()), gaps: z.array(z.string()) }),
  modelMeta: z.object({ model: z.string(), inputTokens: z.number(), outputTokens: z.number(), cachedTokens: z.number() }).nullable(),
})
export type VesselBrief = z.infer<typeof vesselBriefSchema>

// ---- evidence handed to the LLM (deterministic, pre-narrative) ----
export interface VesselEvidence {
  imo: string
  identity: VesselIdentity
  history?: VesselHistory | null
  inspections?: VesselInspections | null
  geography: VesselBrief["geography"]
  companies: VesselBrief["companies"]
  fleet: VesselBrief["fleet"]
  sanctions: { status: "NO_MATCH" | "POSSIBLE" | "CONFIRMED"; subjectHit: boolean; companyHits: string[]; sisterHits: { imo: string; name: string | null }[]; matches: VesselSanctionMatch[] }
  parentHits?: { lei: string; name: string; subsidiaryKey: string }[]
  /** Undisclosed/unknown registry ownership placeholders (a concealment flag). */
  undisclosedOwnership?: UndisclosedOwnershipFlag[]
  ais?: AisBrief | null
  signals: VesselSignal[]
  verdict: { decision: VesselVerdict; score: number; drivers: string[] }
  dataCompleteness: { sourcesOk: string[]; gaps: string[] }
}

// ---- the only LLM-authored fields ----
export interface VesselBriefLLMFields {
  executiveSummary: string
  sanctionsNarrative: string
  prediction: string
  recommendation: string
}

// ---- read shape (API → frontend) ----
export const screeningSchema = z.object({
  id: z.string(),
  name: z.string(),
  imo: z.string(),
  /** Set when this screening belongs to an uploaded batch (a set); else null. */
  batchId: z.string().nullish(),
  /** Set when this screening is a run of a recurring monitor; else null. Kept out
   * of the flat sidebar list (monitor runs live under their monitor). */
  monitorId: z.string().nullish(),
  monitorRunId: z.string().nullish(),
  status: projectStatusSchema,
  vesselName: z.string().nullable(),
  flag: z.string().nullable(),
  identity: z.unknown().nullable(),
  graph: z.unknown().nullable(),
  /** User's saved relationship-graph board overlay (positions + annotations). */
  graphBoard: z.unknown().nullable(),
  brief: z.unknown().nullable(),
  steps: z.record(z.string(), stageRecordSchema).nullish().transform((v) => v ?? {}),
  progress: progressSchema.nullable(),
  modelMeta: z.unknown().nullable(),
  error: z.string().nullable(),
  /** Soft-archived: hidden from the active sidebar list. */
  archived: z.boolean().optional().default(false),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Screening = z.infer<typeof screeningSchema>
