import { createOpenRouter } from "@openrouter/ai-sdk-provider"

/**
 * Pre-flight streaming fallback for the chat agent.
 *
 * Unlike the one-shot brief calls (which are atomic request/response and can be
 * retried invisibly), chat STREAMS tokens and runs a multi-step tool loop. Once a
 * visible chunk has been sent, we can NEVER swap providers — that would duplicate
 * or corrupt the turn. So this wrapper only falls back BEFORE the first content
 * part: it peeks the primary's stream, and
 *   - if the primary rejects or errors before any content → restart cleanly on the
 *     fallback provider (the client has seen nothing yet);
 *   - once the first content part arrives → commit to the primary and pass every
 *     part through untouched; a later error propagates normally (no swap).
 *
 * The wrapper mirrors the underlying model's own descriptor fields, so it works
 * for whatever provider-spec version the SDK/provider agree on.
 */

// Derive the concrete model + stream types from the provider — avoids importing
// @ai-sdk/provider (a transitive dep) and pins us to whatever spec it produces.
type ChatModel = ReturnType<ReturnType<typeof createOpenRouter>["chat"]>
type StreamOptions = Parameters<ChatModel["doStream"]>[0]
type StreamResult = Awaited<ReturnType<ChatModel["doStream"]>>
type GenerateOptions = Parameters<ChatModel["doGenerate"]>[0]
type StreamPart = StreamResult["stream"] extends ReadableStream<infer P> ? P : never

// Parts that precede any visible output — safe to have buffered when we still
// decide to fall back. Everything else means the turn has begun (commit).
const PRELUDE_TYPES = new Set(["stream-start", "response-metadata"])

/** Prepend already-read parts, then forward the rest of the reader (if any). */
function reassemble(prelude: StreamPart[], reader: ReadableStreamDefaultReader<StreamPart> | null): ReadableStream<StreamPart> {
  return new ReadableStream<StreamPart>({
    start(controller) {
      for (const part of prelude) controller.enqueue(part)
      if (!reader) controller.close()
    },
    async pull(controller) {
      if (!reader) return
      try {
        const { value, done } = await reader.read()
        if (done) controller.close()
        else controller.enqueue(value)
      } catch (err) {
        controller.error(err)
      }
    },
    cancel(reason) {
      void reader?.cancel(reason)
    },
  })
}

/**
 * Start `model`'s stream and read until the first content part. Returns the
 * doStream result (with an equivalent stream) once committed; THROWS if the model
 * rejects or emits an error before any content — signalling the caller to fall
 * back. After the first content part, later errors are passed through untouched.
 */
async function attemptStream(model: ChatModel, options: StreamOptions): Promise<StreamResult> {
  const result = await model.doStream(options) // may reject (transport) → caller falls back
  const reader = result.stream.getReader()
  const prelude: StreamPart[] = []
  for (;;) {
    const { value, done } = await reader.read() // may reject before content → caller falls back
    if (done) return { ...result, stream: reassemble(prelude, null) }
    const part = value as StreamPart & { type: string; error?: unknown }
    if (part.type === "error") {
      // We only get here before any content part (we return on the first one), so
      // this is a pre-content failure — release and fall back.
      reader.releaseLock()
      throw part.error ?? new Error("stream errored before first content")
    }
    prelude.push(value)
    if (!PRELUDE_TYPES.has(part.type)) return { ...result, stream: reassemble(prelude, reader) }
  }
}

export interface FallbackInfo { modelId: string; error: string }

/**
 * Wrap two models so the chat agent tries `primary` first and, only if it fails
 * before streaming any content, transparently restarts on `fallback`.
 */
export function createFallbackModel(primary: ChatModel, fallback: ChatModel, onFallback?: (info: FallbackInfo) => void): ChatModel {
  const wrapper = {
    specificationVersion: primary.specificationVersion,
    provider: primary.provider,
    modelId: primary.modelId,
    supportedUrls: primary.supportedUrls,
    defaultObjectGenerationMode: (primary as { defaultObjectGenerationMode?: unknown }).defaultObjectGenerationMode,

    async doStream(options: StreamOptions): Promise<StreamResult> {
      try {
        return await attemptStream(primary, options)
      } catch (err) {
        onFallback?.({ modelId: primary.modelId, error: err instanceof Error ? err.message : String(err) })
        // If the fallback also fails, this rejects → streamText's onError handles it.
        return attemptStream(fallback, options)
      }
    },

    async doGenerate(options: GenerateOptions) {
      try {
        return await primary.doGenerate(options)
      } catch (err) {
        onFallback?.({ modelId: primary.modelId, error: err instanceof Error ? err.message : String(err) })
        return fallback.doGenerate(options)
      }
    },
  }
  return wrapper as unknown as ChatModel
}
