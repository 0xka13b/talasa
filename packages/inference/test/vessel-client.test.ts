import { describe, it, expect, vi, afterEach } from "vitest"
import { InferenceClient } from "../src/client.js"
import type { VesselEvidence } from "@talasa/shared"

const evidence: VesselEvidence = {
  imo: "9304162",
  identity: { imo: "9304162", name: "SUBJECT", flag: "Gabon", type: null, grossTonnage: null, deadweight: null, yearBuilt: null, classSociety: null, mmsi: null, callSign: null, status: null, riskyFlag: true, detentionRate: null, parisMou: null, tokyoMou: null },
  companies: [],
  geography: [],
  fleet: { companies: [], sisters: [], truncated: false, note: null },
  sanctions: { status: "NO_MATCH", subjectHit: false, companyHits: [], sisterHits: [], matches: [] },
  signals: [{ kind: "risky_flag", severity: "weak", detail: "Gabon" }],
  verdict: { decision: "CAUTION", score: 35, drivers: ["flag.high_risk"] },
  dataCompleteness: { sourcesOk: ["equasis"], gaps: ["ais_history"] },
}

afterEach(() => vi.restoreAllMocks())

describe("synthesizeVesselBrief", () => {
  it("posts the vessel schema and parses the four narrative fields", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        model: "test-model",
        usage: { prompt_tokens: 10, completion_tokens: 20 },
        choices: [{ message: { content: JSON.stringify({
          executiveSummary: "es", sanctionsNarrative: "sn", prediction: "pred", recommendation: "rec",
        }) } }],
      }), { status: 200 }),
    )
    const client = new InferenceClient({ baseUrl: "http://x", apiKey: "k", model: "m" })
    const { fields, usage } = await client.synthesizeVesselBrief(evidence)
    expect(fields).toEqual({ executiveSummary: "es", sanctionsNarrative: "sn", prediction: "pred", recommendation: "rec" })
    expect(usage.inputTokens).toBe(10)
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string)
    expect(body.response_format.json_schema.name).toBe("vessel_screening_brief_llm")
  })
})
