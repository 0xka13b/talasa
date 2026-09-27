/** Inputs to a counterparty DD run, derived from the `projects` row. */
export interface CaseInput {
  /** The counterparty name the broker typed (fuzzy). */
  queryName: string
  /** Optional Equasis company number — resolves the counterparty directly. */
  companyImo: string | null
  /** Registered address of the picked Equasis company (from the search result).
   * When present it pins the canonical name too, so resolve skips a redundant
   * Equasis lookup and network uses it as the company-profile address fallback. */
  companyAddress: string | null
  /** The broker's role relative to the counterparty (charterer/owner/…/unknown). */
  role: string | null
  /** Optional jurisdiction hint, used to disambiguate + filter sanctions. */
  country: string | null
}

/** Cap on fleet vessels whose full ship page + inspections are fetched during the
 * network crawl. Ship pages are expensive and Equasis is aggressively throttled
 * (flagged account → 1 req/30s in prod), so keep this conservative. */
export const MAX_FLEET_SAMPLE = 15
/** Cap on fleet vessels screened by IMO against OpenSanctions (subject + affiliate
 * fleets combined). OpenSanctions is our hosted yente, so this can exceed the
 * Equasis sample cap without the same throttling cost. */
export const MAX_VESSELS_SCREENED = 25
/** Max linked companies whose OWN fleet we additionally enumerate — the second-
 * level crawl that turns "who shares a vessel" into "and what else do they run".
 * Each expansion is one throttled Equasis fleet call, so keep it bounded. */
export const MAX_LINKED_EXPANDED = 8
/** Cap on vessels listed per affiliated company (stored on the affiliate + shown
 * in the relationship graph) — keeps the network view legible, not exhaustive. */
export const MAX_AFFILIATE_FLEET_SAMPLE = 8
