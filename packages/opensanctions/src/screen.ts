import {
  DIRECT_SANCTION_TOPICS,
  LINKED_SANCTION_TOPICS,
  PEP_TOPICS,
  POI_TOPICS,
  RISK_TOPICS,
} from "./constants"
import { defaultLabel, isIdentifierTier } from "./entity"
import type {
  SanctionCategory,
  ScoredEntity,
  ScreenTarget,
  ScreeningDecision,
  ScreeningMatch,
  ScreeningResult,
} from "./types"

const RISK_TOPIC_SET: ReadonlySet<string> = new Set(RISK_TOPICS)
const DIRECT_SET: ReadonlySet<string> = new Set(DIRECT_SANCTION_TOPICS)
const LINKED_SET: ReadonlySet<string> = new Set(LINKED_SANCTION_TOPICS)
const PEP_SET: ReadonlySet<string> = new Set(PEP_TOPICS)
const POI_SET: ReadonlySet<string> = new Set(POI_TOPICS)

/** Worst-first ranking so we can roll several results up to one overall decision. */
const DECISION_RANK: Record<ScreeningDecision, number> = { clear: 0, review: 1, hit: 2 }

/**
 * Classify a match from its topics, most-severe first. A direct designation wins
 * over a mere link; a link wins over a PEP/POI note. This is what lets the UI say
 * "sanction-linked" instead of falsely implying a party is itself sanctioned.
 */
export function classifyCategory(topics: string[]): SanctionCategory {
  if (topics.some((t) => DIRECT_SET.has(t))) return "sanctioned"
  if (topics.some((t) => LINKED_SET.has(t))) return "sanction_linked"
  if (topics.some((t) => PEP_SET.has(t))) return "pep"
  if (topics.some((t) => POI_SET.has(t))) return "poi"
  return "other"
}

/** Map a raw scored entity to a domain match, deriving the sanctions flag from topics. */
export function toScreeningMatch(entity: ScoredEntity): ScreeningMatch {
  const topics = readStrings(entity, "topics")
  // The "why listed" narrative lives in the FtM `notes`/`description` properties; keep
  // both so a brief can show the designation rationale, not just the topic tags.
  const notes = readStrings(entity, "notes")
  const description = readString(entity, "description") ?? notes[0] ?? null
  return {
    id: entity.id,
    caption: entity.caption,
    schema: entity.schema,
    score: entity.score,
    isMatch: entity.match,
    target: entity.target,
    topics,
    datasets: entity.datasets,
    notes,
    description,
    sanctioned: topics.some((topic) => RISK_TOPIC_SET.has(topic)),
    category: classifyCategory(topics),
    firstSeen: entity.first_seen ?? null,
    lastSeen: entity.last_seen ?? null,
    lastChange: entity.last_change ?? null,
  }
}

/**
 * Decision ladder (per the data-enrichment plan §2): a confirmed match carrying a
 * sanctions topic is a `hit` when it came from a strong identifier (Tier-1) and a
 * `review` when it's name-based (Tier-3, never auto-reject); otherwise `clear`.
 */
export function classifyDecision(matches: ScreeningMatch[], identifierTier: boolean): ScreeningDecision {
  const risky = matches.some((match) => match.sanctioned && match.isMatch)
  if (!risky) {
    return "clear"
  }
  return identifierTier ? "hit" : "review"
}

/** Build a full result for one target from its scored candidates. */
export function buildScreeningResult(target: ScreenTarget, scored: ScoredEntity[]): ScreeningResult {
  const matches = scored.map(toScreeningMatch)
  return {
    label: target.label ?? defaultLabel(target),
    kind: target.kind,
    decision: classifyDecision(matches, isIdentifierTier(target)),
    matches,
  }
}

/** Reduce several decisions to the most severe one. */
export function worstDecision(decisions: ScreeningDecision[]): ScreeningDecision {
  return decisions.reduce<ScreeningDecision>(
    (worst, current) => (DECISION_RANK[current] > DECISION_RANK[worst] ? current : worst),
    "clear",
  )
}

/** Read an FtM string-valued property (ignoring nested-entity values). */
function readStrings(entity: ScoredEntity, prop: string): string[] {
  const values = entity.properties[prop]
  if (!Array.isArray(values)) {
    return []
  }
  return values.filter((value): value is string => typeof value === "string")
}

/** Read the first value of an FtM string-valued property, or `null` if absent. */
function readString(entity: ScoredEntity, prop: string): string | null {
  return readStrings(entity, prop)[0] ?? null
}
