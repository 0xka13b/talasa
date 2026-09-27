import type { BriefLLMFields, DDEvidence, VesselBriefLLMFields, VesselEvidence } from "@talasa/shared"
import { InferenceHttpError } from "./errors"
import { LLM_FIELDS_SCHEMA, SYSTEM_RUBRIC } from "./prompt"
import { VESSEL_LLM_FIELDS_SCHEMA, VESSEL_SYSTEM_RUBRIC } from "./vessel-prompt"
import { OWNERSHIP_LLM_SCHEMA, OWNERSHIP_SYSTEM_RUBRIC } from "./ownership-prompt"
import type { OwnershipInferenceFields, OwnershipInferenceInput } from "./ownership-prompt"

/** A single OpenAI-compatible provider (primary or fallback). */
export interface InferenceProvider { baseUrl: string; apiKey: string; model: string; resolverModel?: string }
export interface InferenceConfig {
  baseUrl: string; apiKey: string; model: string; resolverModel?: string; maxTokens?: number
  /** Secondary provider tried when a primary call fails (network / non-2xx). Same
   * OpenAI-compatible contract; keeps screenings running if the primary is down. */
  fallback?: InferenceProvider
  /** Notified when a call falls back from one provider to the next. */
  onFallback?: (info: { from: string; to: string; status: number | null; error: string }) => void
}
export interface Usage { model: string; inputTokens: number; outputTokens: number; cachedTokens: number }

export class InferenceClient {
  constructor(private readonly cfg: InferenceConfig) {}

  async synthesizeBrief(evidence: DDEvidence): Promise<{ fields: BriefLLMFields; usage: Usage }> {
    const body = await this.post([
      { role: "system", content: SYSTEM_RUBRIC },
      { role: "user", content: JSON.stringify(evidence) },
    ], { type: "json_schema", json_schema: LLM_FIELDS_SCHEMA })
    const fields = JSON.parse(content(body)) as BriefLLMFields
    return { fields, usage: usage(body) }
  }

  async synthesizeVesselBrief(evidence: VesselEvidence): Promise<{ fields: VesselBriefLLMFields; usage: Usage }> {
    const body = await this.post([
      { role: "system", content: VESSEL_SYSTEM_RUBRIC },
      { role: "user", content: JSON.stringify(evidence) },
    ], { type: "json_schema", json_schema: VESSEL_LLM_FIELDS_SCHEMA })
    const fields = JSON.parse(content(body)) as VesselBriefLLMFields
    return { fields, usage: usage(body) }
  }

  /**
   * Infer candidate owners/operators behind an undisclosed registry ownership,
   * from sanctions-list narrative evidence. Opt-in — callers run this only when a
   * concealment placeholder is detected. Returns a hypothesis, never a fact.
   */
  async inferOwnership(input: OwnershipInferenceInput): Promise<{ fields: OwnershipInferenceFields; usage: Usage }> {
    const body = await this.post([
      { role: "system", content: OWNERSHIP_SYSTEM_RUBRIC },
      { role: "user", content: JSON.stringify(input) },
    ], { type: "json_schema", json_schema: OWNERSHIP_LLM_SCHEMA })
    const fields = JSON.parse(content(body)) as OwnershipInferenceFields
    return { fields, usage: usage(body) }
  }

  async choose<T extends string>(question: string, options: T[]): Promise<T> {
    const schema = { name: "choice", strict: true, schema: { type: "object", additionalProperties: false, required: ["choice"], properties: { choice: { type: "string", enum: options } } } }
    const body = await this.post([
      { role: "system", content: "Pick exactly one option. Answer with the option verbatim." },
      { role: "user", content: `${question}\nOptions: ${options.join(" | ")}` },
    ], { type: "json_schema", json_schema: schema }, true)
    return (JSON.parse(content(body)) as { choice: T }).choice
  }

  /** The providers to try in order — primary first, then the optional fallback.
   * `useResolver` swaps in each provider's resolver model for the `choose` call. */
  private providers(useResolver: boolean): InferenceProvider[] {
    const modelOf = (p: { model: string; resolverModel?: string }) => (useResolver ? p.resolverModel ?? p.model : p.model)
    const list: InferenceProvider[] = [
      { baseUrl: this.cfg.baseUrl, apiKey: this.cfg.apiKey, model: modelOf(this.cfg) },
    ]
    if (this.cfg.fallback) {
      const f = this.cfg.fallback
      list.push({ baseUrl: f.baseUrl, apiKey: f.apiKey, model: modelOf(f) })
    }
    return list
  }

  /** POST to each provider in turn, returning the first success; the last error
   * propagates only after every provider (primary + fallback) has failed. */
  private async post(messages: unknown, responseFormat: unknown, useResolver = false): Promise<Record<string, unknown>> {
    const providers = this.providers(useResolver)
    let lastErr: unknown
    for (let i = 0; i < providers.length; i++) {
      try {
        return await this.call(providers[i]!, messages, responseFormat)
      } catch (err) {
        lastErr = err
        const next = providers[i + 1]
        if (!next) break
        this.cfg.onFallback?.({
          from: providers[i]!.baseUrl,
          to: next.baseUrl,
          status: err instanceof InferenceHttpError ? err.status : null,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
    throw lastErr
  }

  private async call(provider: InferenceProvider, messages: unknown, responseFormat: unknown): Promise<Record<string, unknown>> {
    const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` }
    // OpenRouter-only metadata header; harmless to omit for other providers.
    if (/openrouter\.ai/i.test(provider.baseUrl)) headers["X-OpenRouter-Metadata"] = "enabled"
    const res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: provider.model, messages, response_format: responseFormat, temperature: 0.2, ...(this.cfg.maxTokens ? { max_tokens: this.cfg.maxTokens } : {}) }),
    })
    const text = await res.text()
    if (!res.ok) throw new InferenceHttpError(res.status, text.slice(0, 200))
    return JSON.parse(text) as Record<string, unknown>
  }
}

function content(body: Record<string, unknown>): string {
  const choices = body.choices as { message?: { content?: string } }[] | undefined
  const c = choices?.[0]?.message?.content
  if (typeof c !== "string") throw new InferenceHttpError(200, "no content in response")
  return c
}

function usage(body: Record<string, unknown>): Usage {
  const u = (body.usage ?? {}) as Record<string, unknown>
  const details = (u.prompt_tokens_details ?? {}) as Record<string, unknown>
  return {
    model: typeof body.model === "string" ? body.model : "",
    inputTokens: Number(u.prompt_tokens ?? 0),
    outputTokens: Number(u.completion_tokens ?? 0),
    cachedTokens: Number(details.cached_tokens ?? 0),
  }
}
