import { z } from "zod"

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  INFERENCE_URL: z.string().default("https://openrouter.ai/api/v1"),
  INFERENCE_API_KEY: z.string().default(""),
  INFERENCE_MODEL: z.string().default(""),
  DD_RESOLVER_MODEL: z.string().default(""),
  INFERENCE_MAX_TOKENS: z.coerce.number().default(2000),
  // Optional fallback inference provider (OpenAI-compatible, e.g. anyapi.ai) tried
  // when the primary (OpenRouter) call fails. Blank URL/key → no fallback.
  // INFERENCE_FALLBACK_MODEL defaults to INFERENCE_MODEL when unset.
  INFERENCE_FALLBACK_URL: z.string().default(""),
  INFERENCE_FALLBACK_API_KEY: z.string().default(""),
  INFERENCE_FALLBACK_MODEL: z.string().default(""),
  EQUASIS_EMAIL: z.string().default(""),
  EQUASIS_PASSWORD: z.string().default(""),
  EQUASIS_BASE_URL: z.string().default("https://www.equasis.org/EquasisWeb"),
  // Minimum gap between Equasis requests (serialized throttle). Default 30s —
  // Equasis flags aggressive scraping (a session was cancelled), so stay conservative.
  EQUASIS_MIN_REQUEST_INTERVAL_MS: z.coerce.number().default(30000),
  // Local yente by default (no key). For the hosted API set the base URL to
  // https://api.opensanctions.org and provide OPENSANCTIONS_API_KEY.
  OPENSANCTIONS_API_KEY: z.string().default(""),
  OPENSANCTIONS_BASE_URL: z.string().default("http://localhost:8000"),
  GLEIF_BASE_URL: z.string().default("https://api.gleif.org/api/v1"),
  GLEIF_MIN_REQUEST_INTERVAL_MS: z.coerce.number().default(1000),
  // Datalastic (AIS). Blank key → the AIS stage is skipped (surfaced as a data gap),
  // so the pipeline still runs without a Datalastic subscription.
  DATALASTIC_API_KEY: z.string().default(""),
  DATALASTIC_BASE_URL: z.string().default("https://api.datalastic.com/api/v0"),
  DATALASTIC_MIN_REQUEST_INTERVAL_MS: z.coerce.number().default(1000),
  // Trailing history window analysed per screening (days). ~1 credit/day on Datalastic.
  VESSEL_AIS_HISTORY_DAYS: z.coerce.number().default(90),
  // Google Geocoding API (reverse-geocode AIS event coordinates → place labels).
  // Blank key → events keep `place: null` (map still renders, just without labels).
  GOOGLE_MAPS_API_KEY: z.string().default(""),
  GOOGLE_GEOCODE_BASE_URL: z.string().default("https://maps.googleapis.com/maps/api/geocode/json"),
  GOOGLE_GEOCODE_MIN_REQUEST_INTERVAL_MS: z.coerce.number().default(120),
  WORKER_POLL_MS: z.coerce.number().default(2000),
  WORKER_LEASE_MINUTES: z.coerce.number().default(10),
  VESSEL_MAX_SISTERS_PER_COMPANY: z.coerce.number().default(25),
  VESSEL_MAX_SISTER_PAGES: z.coerce.number().default(60),
})

export const env = envSchema.parse(process.env)
export type Env = typeof env
