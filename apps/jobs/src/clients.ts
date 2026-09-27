import { EquasisClient } from "@talasa/equasis"
import { OpenSanctionsClient } from "@talasa/opensanctions"
import { GleifClient } from "@talasa/gleif"
import { DatalasticClient } from "@talasa/datalastic"
import { InferenceClient } from "@talasa/inference"
import { GeocodeClient } from "./geocode"
import { logger } from "./log"
import type { Env } from "./env"

export interface Clients {
  equasis: EquasisClient
  opensanctions: OpenSanctionsClient
  gleif: GleifClient
  // Null when no DATALASTIC_API_KEY is configured — the AIS stage then reports
  // the data as unavailable rather than failing the run.
  datalastic: DatalasticClient | null
  inference: InferenceClient
  // Null when no GOOGLE_MAPS_API_KEY is configured — AIS events then keep
  // `place: null` and the map renders points without labels.
  geocoder: GeocodeClient | null
}

export function buildClients(env: Env): Clients {
  return {
    equasis: new EquasisClient({ email: env.EQUASIS_EMAIL, password: env.EQUASIS_PASSWORD, baseUrl: env.EQUASIS_BASE_URL, minRequestIntervalMs: env.EQUASIS_MIN_REQUEST_INTERVAL_MS }),
    opensanctions: new OpenSanctionsClient({ apiKey: env.OPENSANCTIONS_API_KEY, baseUrl: env.OPENSANCTIONS_BASE_URL }),
    gleif: new GleifClient({
      baseUrl: env.GLEIF_BASE_URL,
      minRequestIntervalMs: env.GLEIF_MIN_REQUEST_INTERVAL_MS,
    }),
    datalastic: env.DATALASTIC_API_KEY
      ? new DatalasticClient({ apiKey: env.DATALASTIC_API_KEY, baseUrl: env.DATALASTIC_BASE_URL, minRequestIntervalMs: env.DATALASTIC_MIN_REQUEST_INTERVAL_MS })
      : null,
    inference: new InferenceClient({
      baseUrl: env.INFERENCE_URL,
      apiKey: env.INFERENCE_API_KEY,
      model: env.INFERENCE_MODEL,
      resolverModel: env.DD_RESOLVER_MODEL || undefined,
      maxTokens: env.INFERENCE_MAX_TOKENS,
      fallback: env.INFERENCE_FALLBACK_URL && env.INFERENCE_FALLBACK_API_KEY
        ? {
            baseUrl: env.INFERENCE_FALLBACK_URL,
            apiKey: env.INFERENCE_FALLBACK_API_KEY,
            model: env.INFERENCE_FALLBACK_MODEL || env.INFERENCE_MODEL,
            resolverModel: env.DD_RESOLVER_MODEL || undefined,
          }
        : undefined,
      onFallback: (info) => logger.warn(info, "inference primary failed — retrying on fallback provider"),
    }),
    geocoder: env.GOOGLE_MAPS_API_KEY
      ? new GeocodeClient({ apiKey: env.GOOGLE_MAPS_API_KEY, baseUrl: env.GOOGLE_GEOCODE_BASE_URL, minRequestIntervalMs: env.GOOGLE_GEOCODE_MIN_REQUEST_INTERVAL_MS })
      : null,
  }
}
