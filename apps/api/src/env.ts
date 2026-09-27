import { z } from "zod"

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url(),
  // One or more allowed origins (comma-separated); app.ts splits + also reflects localhost ports.
  CORS_ORIGIN: z.string().min(1),
  INFERENCE_URL: z.string().default(""),
  INFERENCE_API_KEY: z.string().default(""),
  INFERENCE_MODEL: z.string().default(""),
  // Model for the interactive chat agent. Must be tool-capable. Falls back to
  // INFERENCE_MODEL when unset.
  CHAT_MODEL: z.string().default(""),
  // Vision model (via the same OpenRouter creds) for the satellite-image analysis
  // chat tool. Must be multimodal. Defaults to Qwen3-VL-32B.
  VISION_MODEL: z.string().default("qwen/qwen3-vl-32b-instruct"),
  // Optional fallback inference provider (OpenAI-compatible, e.g. anyapi.ai). Used
  // by chat only as a PRE-FLIGHT fallback (before the first streamed token). Blank
  // URL/key → no fallback. Model blank → reuses the chat/primary model.
  INFERENCE_FALLBACK_URL: z.string().default(""),
  INFERENCE_FALLBACK_API_KEY: z.string().default(""),
  INFERENCE_FALLBACK_MODEL: z.string().default(""),
  // Exa (https://exa.ai) API key — powers the chat agent's web_search /
  // get_contents / find_similar tools. When empty, those tools report
  // themselves unavailable instead of failing.
  EXA_API_KEY: z.string().default(""),
  EQUASIS_EMAIL: z.string().default(""),
  EQUASIS_PASSWORD: z.string().default(""),
  EQUASIS_BASE_URL: z.string().default("https://www.equasis.org/EquasisWeb"),
  // Minimum gap between Equasis requests (serialized throttle). Default 30s —
  // Equasis flags aggressive scraping, so stay conservative.
  EQUASIS_MIN_REQUEST_INTERVAL_MS: z.coerce.number().default(30000),
  // Copernicus Data Space Ecosystem (Sentinel Hub) OAuth2 client credentials —
  // powers on-demand Sentinel-1 SAR verification of STS candidates. Blank → the
  // SAR endpoint reports itself unconfigured instead of failing.
  CDSE_CLIENT_ID: z.string().default(""),
  CDSE_CLIENT_SECRET: z.string().default(""),
  CDSE_BASE_URL: z.string().default("https://sh.dataspace.copernicus.eu"),
  // Datalastic — used here only to look up a vessel's registered length/beam so
  // the SAR correlation can run its beam-doubling test. Blank → dims skipped.
  DATALASTIC_API_KEY: z.string().default(""),
  DATALASTIC_BASE_URL: z.string().default("https://api.datalastic.com/api/v0"),
  DATALASTIC_MIN_REQUEST_INTERVAL_MS: z.coerce.number().default(1000),
  PORT: z.coerce.number().default(8787),
})

export const env = envSchema.parse(process.env)

// Guard against the classic "deployed with the dev .env" mistake. In production a
// localhost / http origin means the browser's real HTTPS origin gets rejected by
// CORS and better-auth won't issue secure cookies — i.e. the whole app 403s and
// login never sticks. Zod can't catch this (localhost is a valid string), so fail
// fast with an actionable message rather than serving a silently-broken site.
if (env.NODE_ENV === "production") {
  const looksLocal = (v: string) => /localhost|127\.0\.0\.1/.test(v)
  const bad: string[] = []
  if (looksLocal(env.CORS_ORIGIN)) bad.push(`CORS_ORIGIN=${env.CORS_ORIGIN}`)
  if (looksLocal(env.BETTER_AUTH_URL) || env.BETTER_AUTH_URL.startsWith("http://"))
    bad.push(`BETTER_AUTH_URL=${env.BETTER_AUTH_URL}`)
  if (bad.length > 0) {
    throw new Error(
      `Refusing to start in production with dev-looking origins: ${bad.join(", ")}. ` +
        "Set CORS_ORIGIN=https://<platform-domain> and BETTER_AUTH_URL=https://<api-domain> " +
        "in the production .env.",
    )
  }
}
