/** Base class for every error this package throws, so callers can `instanceof` one type. */
export class EquasisError extends Error {}

/** Non-2xx HTTP response from Equasis. */
export class EquasisHttpError extends EquasisError {
  constructor(
    readonly status: number,
    readonly context: string,
  ) {
    super(`Vessel Data Source HTTP error (${status}) — ${context}`)
    this.name = "EquasisHttpError"
  }
}

/** Login could not establish (or re-establish) an authenticated session. The
 * message is intentionally generic + vendor-agnostic: it can surface directly to
 * users on a failed screening, so it must not reveal upstream sources or logic. */
export class SessionExpiredError extends EquasisError {
  constructor() {
    super("Vessel data is temporarily unavailable. Please try again shortly.")
    this.name = "SessionExpiredError"
  }
}

/** The requested entity was not present in an otherwise-valid response. */
export class NotFoundError extends EquasisError {
  constructor(what: string) {
    super(`Vessel Data Source: not found — ${what}`)
    this.name = "NotFoundError"
  }
}

/** A page loaded but its expected structure could not be parsed/validated. */
export class ParseError extends EquasisError {
  constructor(detail: string) {
    super(`Vessel Data Source: failed to parse page — ${detail}`)
    this.name = "ParseError"
  }
}
