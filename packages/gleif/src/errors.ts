/** Base class so callers can `instanceof` a single type. */
export class GleifError extends Error {}

/** Misconfiguration — thrown before any network call. */
export class GleifConfigError extends GleifError {
  constructor(detail: string) {
    super(`GLEIF: ${detail}`)
    this.name = "GleifConfigError"
  }
}

/** Non-2xx HTTP response from the API (404 is handled as null, not an error). */
export class GleifHttpError extends GleifError {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`GLEIF HTTP ${status}: ${body}`)
    this.name = "GleifHttpError"
  }
}

/** 429 — rate limit hit (60 req/min). */
export class GleifRateLimitError extends GleifHttpError {
  constructor(status: number, body: string) {
    super(status, body)
    this.name = "GleifRateLimitError"
  }
}

/** Request exceeded the configured timeout. */
export class GleifTimeoutError extends GleifError {
  constructor(
    readonly url: string,
    readonly timeoutMs: number,
  ) {
    super(`GLEIF request timed out after ${timeoutMs}ms: ${url}`)
    this.name = "GleifTimeoutError"
  }
}
