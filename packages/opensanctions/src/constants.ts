/** Hosted OpenSanctions API root. */
export const DEFAULT_BASE_URL = "https://api.opensanctions.org"

/** The "default" collection spans sanctions + watchlists + PEPs; we filter on topics. */
export const DEFAULT_DATASET = "default"

/**
 * Pinned to `logic-v2` (not `best`) on purpose: a counterparty DD brief needs
 * reproducible, auditable scores, so a re-run yields the same number. Switch to
 * `best` only if you don't need score stability.
 */
export const DEFAULT_ALGORITHM = "logic-v2"

/** Score at/above which the API flags a candidate as a match. */
export const DEFAULT_THRESHOLD = 0.7

/** Candidates scoring below this are dropped from the response. */
export const DEFAULT_CUTOFF = 0.7

/** Max candidates returned per query. */
export const DEFAULT_LIMIT = 5

/**
 * Topics that constitute a real sanctions / export-control concern and drive a
 * hit/review decision. A `role.pep`-only match is informational, not a hit.
 *
 * NOTE: this deliberately still includes `sanction.linked`, so a party linked to
 * a sanctioned entity is surfaced for review. It does NOT mean the entity is
 * itself sanctioned — use {@link classifyCategory} / the match `category` to tell
 * a direct designation apart from a linked one.
 */
export const RISK_TOPICS = ["sanction", "sanction.linked", "export.control"] as const

// --- Topic groups for classifying a match (see classifyCategory). Kept separate
// from RISK_TOPICS so we can label direct vs linked without changing decisions. ---

/** The entity is itself designated. */
export const DIRECT_SANCTION_TOPICS = ["sanction", "export.control"] as const
/** The entity has a direct relationship with a sanctioned entity, but isn't listed itself. */
export const LINKED_SANCTION_TOPICS = ["sanction.linked"] as const
/** Politically exposed persons and their relatives / close associates. */
export const PEP_TOPICS = ["role.pep", "role.rca"] as const
/** Entity of interest — public-interest scrutiny, no wrongdoing implied. */
export const POI_TOPICS = ["poi"] as const
