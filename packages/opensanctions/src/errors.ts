/** Base class so callers can `instanceof` a single type. */
export class OpenSanctionsError extends Error {}

/** Misconfiguration (e.g. missing API key) — thrown before any network call. */
export class OpenSanctionsConfigError extends OpenSanctionsError {
  constructor(detail: string) {
    super(`OpenSanctions: ${detail}`)
    this.name = "OpenSanctionsConfigError"
  }
}

/** Non-2xx HTTP response from the API. */
export class OpenSanctionsHttpError extends OpenSanctionsError {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`OpenSanctions HTTP ${status}: ${body}`)
    this.name = "OpenSanctionsHttpError"
  }
}

/** 401/403 — missing or invalid API key. */
export class OpenSanctionsAuthError extends OpenSanctionsHttpError {
  constructor(status: number, body: string) {
    super(status, body)
    this.name = "OpenSanctionsAuthError"
  }
}

/** 429 — rate / quota limit hit. */
export class OpenSanctionsRateLimitError extends OpenSanctionsHttpError {
  constructor(status: number, body: string) {
    super(status, body)
    this.name = "OpenSanctionsRateLimitError"
  }
}
