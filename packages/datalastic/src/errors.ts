/** Base class so callers can `instanceof` a single type. */
export class DatalasticError extends Error {}

/** Misconfiguration or invalid arguments — thrown before any network call. */
export class DatalasticConfigError extends DatalasticError {
  constructor(detail: string) {
    super(`Datalastic: ${detail}`)
    this.name = "DatalasticConfigError"
  }
}

/** Non-2xx HTTP response from the API (404 is handled as null, not an error). */
export class DatalasticHttpError extends DatalasticError {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Datalastic HTTP ${status}: ${body}`)
    this.name = "DatalasticHttpError"
  }
}

/**
 * 401/403 — invalid/expired API key, OR the endpoint is not in the current plan.
 * On the Starter tier, add-on endpoints (SAT-E, Route Tracking, ownership,
 * inspections, casualties, engine, classification) answer 403 here.
 */
export class DatalasticAuthError extends DatalasticHttpError {
  constructor(status: number, body: string) {
    super(status, body)
    this.name = "DatalasticAuthError"
  }
}

/** 429 — rate limit hit. */
export class DatalasticRateLimitError extends DatalasticHttpError {
  constructor(status: number, body: string) {
    super(status, body)
    this.name = "DatalasticRateLimitError"
  }
}

/** Request exceeded the configured timeout. */
export class DatalasticTimeoutError extends DatalasticError {
  constructor(
    readonly url: string,
    readonly timeoutMs: number,
  ) {
    super(`Datalastic request timed out after ${timeoutMs}ms: ${url}`)
    this.name = "DatalasticTimeoutError"
  }
}
