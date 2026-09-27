import type { VesselVerdict } from "./vessel.js"

/** Small, opaque registries disproportionately associated with shadow-fleet
 * activity. Deliberately EXCLUDES the large flags-of-convenience (Panama,
 * Liberia, Marshall Islands) which are mostly legitimate. Weak signal only. */
export const HIGH_RISK_FLAGS = [
  "gabon", "cameroon", "cook islands", "palau", "comoros", "honduras",
  "djibouti", "sao tome and principe", "são tomé and príncipe", "tanzania",
  "zanzibar", "togo", "sierra leone", "guyana", "eswatini",
] as const

export function isHighRiskFlag(flag: string | null): boolean {
  if (!flag) return false
  const f = flag.trim().toLowerCase()
  return HIGH_RISK_FLAGS.some((h) => f === h || f.includes(h))
}

/**
 * How a screened entity relates to sanctions:
 *   - `"direct"`: the entity is *itself* designated (topic `sanction` / `export.control`)
 *   - `"linked"`: the entity is tied to a sanctioned entity, but not listed itself
 *     (topic `sanction.linked` — e.g. the manager or owner of a sanctioned vessel)
 *   - `null`: no sanctions match
 * The direct/linked split is the crux of the model: a direct designation is a
 * legal prohibition (hard BLOCK); a link is a risk signal (weighted points).
 */
export type SanctionSeverity = "direct" | "linked" | null

export interface VesselScoreInput {
  /** Subject vessel matched by IMO (identifier tier) — direct, linked, or none. */
  subjectSanction: SanctionSeverity
  /** Strongest sanction on any registered owner / ISM / commercial manager. */
  managementSanction: SanctionSeverity
  /** Strongest sanction on a direct/ultimate parent owner (via GLEIF). */
  parentSanction: SanctionSeverity
  /** Sister vessels that are themselves designated. */
  directSisterCount: number
  /** Sister vessels linked to a sanctioned entity (weaker signal). */
  linkedSisterCount: number
  riskyFlag: boolean
  /** Parsed detention rate above threshold. */
  highDetention: boolean
  /** Paris or Tokyo MoU color in {black, grey}. */
  mouBlackOrGrey: boolean
  /** Name-tier (`review`), low-confidence sanctions match on the subject vessel. */
  subjectReviewMatch: boolean
  /** Subject vessel is an OpenSanctions "person/entity of interest" (topic `poi`)
   * — e.g. a shadow-fleet tanker. Not a formal designation, but strong evidence. */
  subjectPoi?: boolean
  /** PSC inspections by a suspect-country authority (e.g. Russia on/after 2022). */
  suspectPortCallCount?: number
  /** A recent geographic sighting in a suspect-country area. */
  suspectAreaVisit?: boolean
  /** Sanctions stage failed/skipped — cannot clear what we could not screen. */
  sanctionsUnavailable: boolean
  // ---- AIS behaviour (from Datalastic track analysis; all optional/additive) ----
  /** Count of AIS transmission gaps ≥ threshold over the analysed window. */
  darkGapCount?: number
  /** At least one dark gap or STS-candidate loiter sat in a high-risk STS zone. */
  darkGapInHighRiskZone?: boolean
  /** Count of suspected ship-to-ship loitering events (counterparty unconfirmed). */
  stsCandidateCount?: number
  /** Count of implausible-speed segments (possible position spoofing). */
  speedAnomalyCount?: number
}

/**
 * Point weights for the weighted signals. Kept as one table so the model is
 * auditable in one place — see docs/scoring.md for the rationale a
 * compliance reviewer needs. A *direct* designation on the subject or management
 * is NOT in this table: it short-circuits to BLOCK before any points are summed.
 */
export const VESSEL_SCORE_WEIGHTS = {
  subjectLinked: 50,
  managementLinked: 40,
  parentDirect: 50,
  parentLinked: 25,
  directSisterEach: 35,
  directSisterCap: 60,
  linkedSisterEach: 15,
  linkedSisterCap: 30,
  subjectPoi: 45,
  suspectPortCall: 15,
  suspectAreaVisit: 10,
  subjectReview: 20,
  highDetention: 20,
  mouListed: 10,
  riskyFlag: 10,
  // AIS behaviour — suspected, never dispositive.
  aisDarkGapHighRisk: 20,
  aisDarkGap: 10,
  aisStsCandidate: 15,
  aisSpeedAnomaly: 10,
} as const

const BLOCK_FLOOR = 70
const CAUTION_FLOOR = 35

export function computeVesselVerdict(input: VesselScoreInput): {
  decision: VesselVerdict
  score: number
  drivers: string[]
} {
  const drivers: string[] = []
  const w = VESSEL_SCORE_WEIGHTS

  // Hard BLOCK: a *direct* designation on the subject vessel or its management
  // chain is a legal prohibition, not something to weigh against other factors.
  if (input.subjectSanction === "direct" || input.managementSanction === "direct") {
    if (input.subjectSanction === "direct") drivers.push("sanctions.subject_designated")
    if (input.managementSanction === "direct") drivers.push("sanctions.management_designated")
    return { decision: "BLOCK", score: 100, drivers }
  }

  let score = 0
  const add = (points: number, driver: string) => { score += points; drivers.push(driver) }

  // Sanctions linkage — real risk, but softer than a direct designation.
  if (input.subjectSanction === "linked") add(w.subjectLinked, "sanctions.subject_linked")
  // Subject listed as a person/entity of interest (e.g. shadow-fleet tanker).
  if (input.subjectPoi) add(w.subjectPoi, "sanctions.subject_poi")
  if (input.managementSanction === "linked") add(w.managementLinked, "sanctions.management_linked")
  if (input.parentSanction === "direct") add(w.parentDirect, "ownership.parent_designated")
  else if (input.parentSanction === "linked") add(w.parentLinked, "ownership.parent_linked")

  const directSister = Math.min(input.directSisterCount * w.directSisterEach, w.directSisterCap)
  if (directSister > 0) add(directSister, "fleet.sister_designated")
  const linkedSister = Math.min(input.linkedSisterCount * w.linkedSisterEach, w.linkedSisterCap)
  if (linkedSister > 0) add(linkedSister, "fleet.sister_linked")

  // Suspect-country activity (e.g. Russia port calls / sightings after 2022).
  if ((input.suspectPortCallCount ?? 0) > 0) add(w.suspectPortCall, "psc.suspect_port_call")
  if (input.suspectAreaVisit) add(w.suspectAreaVisit, "geo.suspect_area")

  // Vessel-quality signals.
  if (input.subjectReviewMatch) add(w.subjectReview, "sanctions.name_review")
  if (input.highDetention) add(w.highDetention, "psc.detention_rate")
  if (input.mouBlackOrGrey) add(w.mouListed, "mou.listed")
  if (input.riskyFlag) add(w.riskyFlag, "flag.high_risk")

  // AIS behaviour — suspected, never dispositive. Weak/strong contributors only.
  if (input.darkGapInHighRiskZone) add(w.aisDarkGapHighRisk, "ais.dark_gap_high_risk")
  else if ((input.darkGapCount ?? 0) > 0) add(w.aisDarkGap, "ais.dark_gap")
  if ((input.stsCandidateCount ?? 0) > 0) add(w.aisStsCandidate, "ais.sts_candidate")
  if ((input.speedAnomalyCount ?? 0) > 0) add(w.aisSpeedAnomaly, "ais.speed_anomaly")

  score = Math.min(score, 100)
  let decision = band(score)

  // Gap floor: never PROCEED if we could not run sanctions screening.
  if (input.sanctionsUnavailable) {
    drivers.push("sanctions.unavailable")
    if (decision === "PROCEED") decision = "CAUTION"
  }

  return { decision, score, drivers }
}

/** Combine two severities, keeping the stronger (`direct` > `linked` > none). */
export function strongestSeverity(a: SanctionSeverity, b: SanctionSeverity): SanctionSeverity {
  if (a === "direct" || b === "direct") return "direct"
  if (a === "linked" || b === "linked") return "linked"
  return null
}

function band(score: number): VesselVerdict {
  if (score >= BLOCK_FLOOR) return "BLOCK"
  if (score >= CAUTION_FLOOR) return "CAUTION"
  return "PROCEED"
}
