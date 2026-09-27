import { CopernicusClient } from "@talasa/copernicus"
import { env } from "../env"

let client: CopernicusClient | null = null

/**
 * Lazily build a single shared Copernicus (Sentinel Hub) client — one cached
 * OAuth token + throttle for the whole process. Throws if credentials aren't
 * configured so the SAR route can surface a clear error instead of hanging.
 */
export function getCopernicusClient(): CopernicusClient {
  if (env.CDSE_CLIENT_ID === "" || env.CDSE_CLIENT_SECRET === "") {
    throw new Error("Copernicus is not configured (set CDSE_CLIENT_ID and CDSE_CLIENT_SECRET)")
  }
  client ??= new CopernicusClient({
    clientId: env.CDSE_CLIENT_ID,
    clientSecret: env.CDSE_CLIENT_SECRET,
    baseUrl: env.CDSE_BASE_URL,
  })
  return client
}

export function isCopernicusConfigured(): boolean {
  return env.CDSE_CLIENT_ID !== "" && env.CDSE_CLIENT_SECRET !== ""
}
