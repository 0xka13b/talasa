import { afterEach, describe, expect, it, vi } from "vitest"
import { InferenceClient } from "../src/index"
import type { DDEvidence } from "@talasa/shared"

const evidence = { counterparty: { canonicalName: "Acme Ltd" }, sanctions: { status: "NO_MATCH", matches: [] } } as unknown as DDEvidence

function mockJson(body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }))
}
afterEach(() => vi.restoreAllMocks())

describe("synthesizeBrief", () => {
  it("posts an OpenAI-shaped request and parses the structured content", async () => {
    const fields = { executiveSummary: "ok", affiliationsNarrative: "", ownershipNarrative: "", sanctionsNarrative: "", riskJustification: "", recommendedActionRationale: "" }
    const spy = mockJson({ model: "x/y", choices: [{ message: { content: JSON.stringify(fields) } }], usage: { prompt_tokens: 100, completion_tokens: 50, prompt_tokens_details: { cached_tokens: 80 } } })
    const client = new InferenceClient({ baseUrl: "https://openrouter.ai/api/v1", apiKey: "k", model: "anthropic/claude", maxTokens: 1500 })
    const out = await client.synthesizeBrief(evidence)

    const [url, init] = spy.mock.calls[0]!
    expect(String(url)).toBe("https://openrouter.ai/api/v1/chat/completions")
    const sent = JSON.parse((init as RequestInit).body as string)
    expect(sent.model).toBe("anthropic/claude")
    expect(sent.response_format.type).toBe("json_schema")
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer k", "X-OpenRouter-Metadata": "enabled" })
    expect(sent.max_tokens).toBe(1500)
    expect(out.fields.executiveSummary).toBe("ok")
    expect(out.usage).toEqual({ model: "x/y", inputTokens: 100, outputTokens: 50, cachedTokens: 80 })
  })

  it("throws InferenceHttpError on non-2xx", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 500 }))
    const client = new InferenceClient({ baseUrl: "https://openrouter.ai/api/v1", apiKey: "k", model: "m" })
    await expect(client.synthesizeBrief(evidence)).rejects.toThrow(/500/)
  })
})

describe("choose", () => {
  it("returns the model's pick constrained to options", async () => {
    mockJson({ model: "m", choices: [{ message: { content: JSON.stringify({ choice: "B" }) } }], usage: {} })
    const client = new InferenceClient({ baseUrl: "https://openrouter.ai/api/v1", apiKey: "k", model: "m", resolverModel: "openai/cheap" })
    expect(await client.choose("which?", ["A", "B"])).toBe("B")
  })
})
