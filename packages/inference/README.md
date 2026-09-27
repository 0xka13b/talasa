# @talasa/inference

The narrative layer of the screening pipelines. A dependency-free client over any
**OpenAI-compatible** `/chat/completions` endpoint — in practice **OpenRouter**, with an optional second provider for failover. Every
call takes evidence already gathered and scored deterministically and returns
**schema-constrained JSON narrative** — the prose for the **Vessel Screening** and
**Counterparty DD** briefs. It never scores, never decides, never fetches: the
verdict is computed upstream and the rubrics forbid restating it. No vendor SDK —
just `fetch` + `response_format: json_schema`, so the model is one env var away.

## Usage

```ts
import { InferenceClient } from "@talasa/inference"

const client = new InferenceClient({
  baseUrl: process.env.INFERENCE_URL!, // required — no implicit default
  apiKey: process.env.INFERENCE_API_KEY!,
  model: "z-ai/glm-5.2",
  maxTokens: 2000,
  fallback: { baseUrl: "https://api.anyapi.ai/v1", apiKey: "…", model: "z-ai/glm-5.2" },
  onFallback: (info) => logger.warn(info, "primary failed — retrying on fallback"),
})

// Vessel brief — 4 narrative fields off the deterministic VesselEvidence:
const { fields, usage } = await client.synthesizeVesselBrief(evidence)
// fields -> { executiveSummary, sanctionsNarrative, prediction, recommendation }
// usage  -> { model, inputTokens, outputTokens, cachedTokens } — persisted as brief.modelMeta

// Counterparty DD brief — 6 narrative fields off DDEvidence:
await client.synthesizeBrief(ddEvidence)
// -> { executiveSummary, affiliationsNarrative, ownershipNarrative,
//      sanctionsNarrative, riskJustification, recommendedActionRationale }

// Opt-in: who is behind an UNDISCLOSED registry owner? Sanctions narratives in,
// ranked hypotheses out. Callers run this only on a concealment placeholder.
await client.inferOwnership({ subject, undisclosed, evidence })
// -> { entities: [{ name, role, signal, strength: "strong"|"moderate"|"weak" }], summary }

// Cheap constrained tie-break (enum schema — the answer is always in `options`):
await client.choose('Which company matches "ACME SHIPPING"?', ["ACME SHIPPING LTD", "ACME SHIPPING SA"])
```

## Structured output is the contract

Each method pairs a system rubric with a `strict: true` JSON schema, both exported
(`VESSEL_SYSTEM_RUBRIC`/`VESSEL_LLM_FIELDS_SCHEMA`, `SYSTEM_RUBRIC`/`LLM_FIELDS_SCHEMA`,
`OWNERSHIP_SYSTEM_RUBRIC`/`OWNERSHIP_LLM_SCHEMA`). Evidence goes in as raw
`JSON.stringify` in the user turn — no prompt templating.

> **Why rubrics this long?** They encode the product's non-negotiables, not style:
> never name the upstream data providers, never conflate *sanctioned* with
> *sanction_linked*, phrase every predictive inference as unverified, and state data
> gaps plainly. That's compliance surface — it belongs in tested code, not a console.

## Providers & failover

`fallback` is tried on **any** primary failure (network error or non-2xx), with
`onFallback` fired per hop; the last error propagates only after every provider
fails. Both must speak the same OpenAI-compatible contract (for example OpenRouter
as primary and anyapi.ai as fallback). `X-OpenRouter-Metadata: enabled` is sent only when the base URL
matches `openrouter.ai`.

## Config

| Option | Default | Notes |
|---|---|---|
| `baseUrl` | — | required; `/chat/completions` is appended. `DEFAULT_BASE_URL` (`https://openrouter.ai/api/v1`) is exported but **not** applied by the client |
| `apiKey` | — | required; sent as `Authorization: Bearer <key>` |
| `model` | — | required |
| `resolverModel` | `model` | cheap model for `choose()` only; set per-provider |
| `maxTokens` | unset | omitted from the body entirely when unset |
| `fallback` | none | secondary `InferenceProvider`; omit for single-provider |
| `onFallback` | none | `{ from, to, status, error }` — `status` is `null` on network errors |

`temperature` is pinned at **0.2** and is not configurable. Consumers wire config from
env (`INFERENCE_URL`, `INFERENCE_API_KEY`, `INFERENCE_MODEL`, `DD_RESOLVER_MODEL`,
`INFERENCE_MAX_TOKENS`, `INFERENCE_FALLBACK_*`) — the package itself reads no env.

## Notes

- **No vision here.** The chat tool's Qwen3-VL read of persisted SAR/optical chips
  (`VISION_MODEL`, default `qwen/qwen3-vl-32b-instruct`) is a *separate* implementation
  in `apps/api/src/services/sar-vision.ts`, built on the Vercel AI SDK +
  `@openrouter/ai-sdk-provider`. `apps/api` does not depend on this package; only
  `apps/jobs` does. This client is text-only and has no image path.
- **No timeout, no retry.** A hung provider hangs the job; a 500 goes straight to the
  fallback rather than retrying. Callers own resilience — `inferOwnership` catches and
  degrades to a flag-only result.
- Errors are typed: `InferenceHttpError` (`status`, `detail` — first 200 chars of the
  body) extends `InferenceError`. A 200 with no `choices[0].message.content` throws it
  too. A malformed JSON body throws raw from `JSON.parse` — strict mode is assumed to hold.
