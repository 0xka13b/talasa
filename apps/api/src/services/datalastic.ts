import { DatalasticClient } from "@talasa/datalastic"
import { env } from "../env"

let client: DatalasticClient | null = null

/** Lazily build a shared Datalastic client, or null when the key is unset. */
function getClient(): DatalasticClient | null {
  if (env.DATALASTIC_API_KEY === "") return null
  client ??= new DatalasticClient({
    apiKey: env.DATALASTIC_API_KEY,
    baseUrl: env.DATALASTIC_BASE_URL,
    minRequestIntervalMs: env.DATALASTIC_MIN_REQUEST_INTERVAL_MS,
  })
  return client
}

/**
 * Best-effort registered dimensions (length overall / beam, metres) for a vessel,
 * used to run the SAR beam-doubling test. Returns nulls when Datalastic is
 * unconfigured, the vessel is unknown, or the lookup errors — the SAR verdict
 * degrades gracefully (it just won't flag `beam_anomaly`).
 */
export async function lookupVesselDims(
  imo: string,
): Promise<{ lengthM: number | null; beamM: number | null }> {
  const dl = getClient()
  if (!dl) return { lengthM: null, beamM: null }
  try {
    const info = await dl.getVesselInfo({ imo })
    return { lengthM: info?.length ?? null, beamM: info?.breadth ?? null }
  } catch {
    return { lengthM: null, beamM: null }
  }
}
