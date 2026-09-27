import { z } from "zod"

// ---------------------------------------------------------------------------
// Screening targets (what we ask the API about). Discriminated by `kind` so the
// client can pick the FtM schema + decide identifier-tier vs name-tier.
// ---------------------------------------------------------------------------

export interface VesselTarget {
  kind: "vessel"
  /** Optional human label for the result (defaults to IMO/MMSI/name). */
  label?: string
  imo?: string
  mmsi?: string
  name?: string
  callSign?: string
  flag?: string
}

export interface CompanyTarget {
  kind: "company"
  label?: string
  name: string
  country?: string
  registrationNumber?: string
}

export interface PersonTarget {
  kind: "person"
  label?: string
  name: string
  country?: string
  birthDate?: string
}

export type ScreenTarget = VesselTarget | CompanyTarget | PersonTarget

// ---------------------------------------------------------------------------
// Raw API response (POST /match/{dataset}) — validated with zod.
// ---------------------------------------------------------------------------

/** A scored candidate entity. FtM `properties` map a key to an array of values. */
export const scoredEntitySchema = z
  .object({
    id: z.string(),
    caption: z.string(),
    schema: z.string(),
    properties: z.record(z.array(z.unknown())).default({}),
    datasets: z.array(z.string()).default([]),
    target: z.boolean().default(false),
    score: z.number().default(0),
    match: z.boolean().default(false),
    // Designation lifecycle timestamps — present on /match results, kept so a
    // brief can show when a listing appeared / was last refreshed.
    first_seen: z.string().nullish(),
    last_seen: z.string().nullish(),
    last_change: z.string().nullish(),
  })
  .passthrough()
export type ScoredEntity = z.infer<typeof scoredEntitySchema>

const entityMatchesSchema = z.object({
  status: z.number().optional(),
  results: z.array(scoredEntitySchema).default([]),
})

export const matchResponseSchema = z.object({
  responses: z.record(entityMatchesSchema),
  limit: z.number().optional(),
})
export type MatchResponse = z.infer<typeof matchResponseSchema>

/** A full entity record (GET /entities/{id}) for drilling down on a match. */
export const entityDetailSchema = z
  .object({
    id: z.string(),
    caption: z.string(),
    schema: z.string(),
    properties: z.record(z.array(z.unknown())).default({}),
    datasets: z.array(z.string()).default([]),
    target: z.boolean().default(false),
    referents: z.array(z.string()).default([]),
    first_seen: z.string().nullish(),
    last_seen: z.string().nullish(),
    last_change: z.string().nullish(),
  })
  .passthrough()
export type EntityDetail = z.infer<typeof entityDetailSchema>

// ---------------------------------------------------------------------------
// Domain results (what the client returns).
// ---------------------------------------------------------------------------

export type ScreeningDecision = "hit" | "review" | "clear"

/**
 * How the matched entity relates to sanctions, derived from its OpenSanctions
 * topics. Critically distinguishes a *direct* designation from an entity that is
 * merely *linked* to a sanctioned party (e.g. the manager of a sanctioned vessel).
 *   - `sanctioned`      — directly designated (`sanction` / `export.control`)
 *   - `sanction_linked` — has a direct relationship with a sanctioned entity (`sanction.linked`)
 *   - `pep`             — politically exposed person / close associate (`role.pep` / `role.rca`)
 *   - `poi`             — entity of interest, no wrongdoing implied (`poi`)
 *   - `other`           — some other listing with no sanctions/PEP topic
 */
export type SanctionCategory = "sanctioned" | "sanction_linked" | "pep" | "poi" | "other"

export interface ScreeningMatch {
  id: string
  caption: string
  /** FtM schema of the matched entity (Person | Company | Organization | Vessel | …). */
  schema: string
  score: number
  /** The API's match flag (score ≥ threshold). */
  isMatch: boolean
  /** Whether the entity is itself a designation target. */
  target: boolean
  /** True when the entity carries a sanctions/export-control topic (not PEP-only). */
  sanctioned: boolean
  /** Direct-vs-linked-vs-PEP classification derived from {@link topics}. */
  category: SanctionCategory
  topics: string[]
  /** Source lists, e.g. `us_ofac_sdn`, `eu_fsf`. */
  datasets: string[]
  /**
   * The "why listed" narrative: the FtM `notes` property values (may be empty). For a
   * POI such as a shadow-fleet tanker this carries the designation rationale.
   */
  notes: string[]
  /**
   * Convenience single-line rationale — the entity's FtM `description`, falling back to
   * the first note, or `null` when the entity carries neither.
   */
  description: string | null
  /** When OpenSanctions first saw / last saw / last changed this listing. */
  firstSeen: string | null
  lastSeen: string | null
  lastChange: string | null
}

export interface ScreeningResult {
  label: string
  kind: ScreenTarget["kind"]
  decision: ScreeningDecision
  matches: ScreeningMatch[]
}

export interface CounterpartyScreening {
  /** Worst decision across every screened target. */
  overall: ScreeningDecision
  results: ScreeningResult[]
}
