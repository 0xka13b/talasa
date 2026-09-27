/** GLEIF JSON:API root. Open API — no key required. */
export const DEFAULT_BASE_URL = "https://api.gleif.org/api/v1"

/** Per-request timeout. */
export const DEFAULT_TIMEOUT_MS = 15000

/**
 * GLEIF caps callers at 60 req/min. `lookupCompany` fires ~3 requests per company
 * across many companies, so requests are serialized with at least this gap.
 */
export const DEFAULT_MIN_REQUEST_INTERVAL_MS = 1000

/** Max fuzzy name candidates to consider. */
export const DEFAULT_FUZZY_LIMIT = 5
