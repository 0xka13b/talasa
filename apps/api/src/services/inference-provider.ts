import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import type { LanguageModel } from "ai"
import { env } from "../env"
import { createFallbackModel } from "./fallback-model"

// OpenRouter is OpenAI-compatible; reuse the pipeline's inference credentials.
// When INFERENCE_URL is unset, the provider falls back to its own default base
// URL (https://openrouter.ai/api/v1).
const primaryProvider = createOpenRouter({
  apiKey: env.INFERENCE_API_KEY,
  baseURL: env.INFERENCE_URL || undefined,
})

// Optional secondary provider (e.g. anyapi.ai) used only when the primary fails
// BEFORE the chat stream emits any content — see createFallbackModel.
const fallbackProvider =
  env.INFERENCE_FALLBACK_URL && env.INFERENCE_FALLBACK_API_KEY
    ? createOpenRouter({ apiKey: env.INFERENCE_FALLBACK_API_KEY, baseURL: env.INFERENCE_FALLBACK_URL })
    : null

/** Model for the interactive chat agent. Must be tool-capable. Wrapped with a
 * pre-flight fallback when a secondary provider is configured. */
export function chatModel(): LanguageModel {
  const modelId = env.CHAT_MODEL || env.INFERENCE_MODEL
  const primary = primaryProvider.chat(modelId)
  if (!fallbackProvider) return primary
  const fallback = fallbackProvider.chat(env.INFERENCE_FALLBACK_MODEL || modelId)
  return createFallbackModel(primary, fallback, (info) =>
    console.warn("[chat] primary model failed before first token — using fallback provider:", info.error),
  )
}

/** Multimodal model for one-shot vision analysis (the satellite-image tool). */
export function visionModel(): LanguageModel {
  return primaryProvider.chat(env.VISION_MODEL)
}
