/** Base class so callers can `instanceof` a single type. */
export class GdeltError extends Error {}

/** Misconfiguration (e.g. an empty query) — thrown before any network call. */
export class GdeltConfigError extends GdeltError {
  constructor(detail: string) {
    super(`GDELT: ${detail}`)
    this.name = "GdeltConfigError"
  }
}

/** Non-2xx response from the DOC API. */
export class GdeltHttpError extends GdeltError {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super(`GDELT HTTP ${status}: ${detail}`)
    this.name = "GdeltHttpError"
  }
}

/**
 * Rate limited. The free DOC API asks for at most one request every ~5 seconds
 * and replies with a plain-text notice (sometimes at HTTP 200, sometimes 429).
 */
export class GdeltRateLimitError extends GdeltError {
  constructor(readonly detail: string) {
    super(`GDELT rate limit: ${detail}`)
    this.name = "GdeltRateLimitError"
  }
}

/**
 * The DOC API rejected the query. GDELT returns HTTP 200 with a plain-text
 * explanation (not JSON) when a query is malformed or too short, so this is
 * detected from the body rather than the status code.
 */
export class GdeltQueryError extends GdeltError {
  constructor(readonly detail: string) {
    super(`GDELT query rejected: ${detail}`)
    this.name = "GdeltQueryError"
  }
}
