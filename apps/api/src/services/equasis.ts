import { EquasisClient } from "@talasa/equasis"
import { env } from "../env"

let client: EquasisClient | null = null

/**
 * Lazily build a single shared Equasis client (one session + throttle for the
 * whole process). Throws if credentials aren't configured so routes can surface
 * a clear error instead of attempting an anonymous scrape.
 */
export function getEquasisClient(): EquasisClient {
  if (env.EQUASIS_EMAIL === "" || env.EQUASIS_PASSWORD === "") {
    throw new Error("Equasis is not configured (set EQUASIS_EMAIL and EQUASIS_PASSWORD)")
  }
  client ??= new EquasisClient({
    email: env.EQUASIS_EMAIL,
    password: env.EQUASIS_PASSWORD,
    baseUrl: env.EQUASIS_BASE_URL,
    minRequestIntervalMs: env.EQUASIS_MIN_REQUEST_INTERVAL_MS,
  })
  return client
}
