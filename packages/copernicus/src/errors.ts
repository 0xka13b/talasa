/** Base class so callers can `instanceof` a single type. */
export class CopernicusError extends Error {}

/** Misconfiguration or invalid arguments — thrown before any network call. */
export class CopernicusConfigError extends CopernicusError {
  constructor(detail: string) {
    super(`Copernicus: ${detail}`)
    this.name = "CopernicusConfigError"
  }
}

/** Non-2xx HTTP response from a Sentinel Hub API. */
export class CopernicusHttpError extends CopernicusError {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Copernicus HTTP ${status}: ${body}`)
    this.name = "CopernicusHttpError"
  }
}

/**
 * 401/403 — invalid/expired token or client credentials, or the requested
 * collection is not accessible to this account (e.g. Copernicus Contributing
 * Missions data on a Public account).
 */
export class CopernicusAuthError extends CopernicusHttpError {
  constructor(status: number, body: string) {
    super(status, body)
    this.name = "CopernicusAuthError"
  }
}

/**
 * 429 — rate limit hit, OR the monthly processing-unit / request quota is
 * exhausted. The response body distinguishes the two.
 */
export class CopernicusRateLimitError extends CopernicusHttpError {
  constructor(status: number, body: string) {
    super(status, body)
    this.name = "CopernicusRateLimitError"
  }
}

/** The OAuth2 token exchange failed (bad credentials, or the token endpoint erroring). */
export class CopernicusTokenError extends CopernicusError {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Copernicus token exchange failed (HTTP ${status}): ${body}`)
    this.name = "CopernicusTokenError"
  }
}

/** Request exceeded the configured timeout. */
export class CopernicusTimeoutError extends CopernicusError {
  constructor(
    readonly url: string,
    readonly timeoutMs: number,
  ) {
    super(`Copernicus request timed out after ${timeoutMs}ms: ${url}`)
    this.name = "CopernicusTimeoutError"
  }
}
