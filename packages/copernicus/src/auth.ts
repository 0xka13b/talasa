import { z } from "zod"
import { DEFAULT_TIMEOUT_MS, TOKEN_ENDPOINT, TOKEN_EXPIRY_SKEW_S } from "./constants"
import { CopernicusTimeoutError, CopernicusTokenError } from "./errors"

/** The subset of the OAuth2 token response we rely on. */
const tokenResponseSchema = z
  .object({
    access_token: z.string(),
    expires_in: z.number(),
    token_type: z.string().optional(),
  })
  .passthrough()

export interface TokenManagerConfig {
  clientId: string
  clientSecret: string
  /** Override the token endpoint (tests). Defaults to the CDSE Keycloak realm. */
  tokenEndpoint?: string
  timeoutMs?: number
}

/**
 * Mints and caches a Sentinel Hub bearer token via OAuth2 client-credentials.
 *
 * A single token is reused until it is within {@link TOKEN_EXPIRY_SKEW_S} of
 * expiry — the token endpoint is rate-limited, so per-call minting is a mistake.
 * Concurrent refreshes are de-duplicated: the first miss kicks off one exchange
 * and every waiter shares its promise.
 */
export class TokenManager {
  private readonly endpoint: string
  private readonly timeoutMs: number
  private token: string | null = null
  /** Unix ms after which {@link token} must not be used. */
  private expiresAtMs = 0
  private inFlight: Promise<string> | null = null

  constructor(private readonly config: TokenManagerConfig) {
    this.endpoint = config.tokenEndpoint ?? TOKEN_ENDPOINT
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  /** A valid bearer token, refreshing if the cached one is missing or near expiry. */
  async getToken(): Promise<string> {
    if (this.token && Date.now() < this.expiresAtMs) {
      return this.token
    }
    // Coalesce concurrent refreshes into one exchange.
    this.inFlight ??= this.exchange().finally(() => {
      this.inFlight = null
    })
    return this.inFlight
  }

  /** Drop the cached token so the next {@link getToken} forces a refresh (e.g. after a 401). */
  invalidate(): void {
    this.token = null
    this.expiresAtMs = 0
  }

  private async exchange(): Promise<string> {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    })

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    let res: Response
    try {
      res = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body,
        signal: controller.signal,
      })
    } catch (err) {
      if (controller.signal.aborted) {
        throw new CopernicusTimeoutError(this.endpoint, this.timeoutMs)
      }
      throw err
    } finally {
      clearTimeout(timer)
    }

    const text = await res.text()
    if (!res.ok) {
      throw new CopernicusTokenError(res.status, text.slice(0, 300))
    }

    const parsed = tokenResponseSchema.parse(JSON.parse(text))
    this.token = parsed.access_token
    this.expiresAtMs = Date.now() + (parsed.expires_in - TOKEN_EXPIRY_SKEW_S) * 1000
    return this.token
  }
}
