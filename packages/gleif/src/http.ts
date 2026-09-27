import { GleifHttpError, GleifRateLimitError, GleifTimeoutError } from "./errors"
import { leiRecordListResponseSchema, leiRecordResponseSchema } from "./types"
import type { FuzzyMatch, LeiRecord } from "./types"

export interface TransportConfig {
  baseUrl: string
  timeoutMs: number
}

async function doFetch(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } })
  } catch (err) {
    if (controller.signal.aborted) {
      throw new GleifTimeoutError(url, timeoutMs)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Match a company name -> candidate LEIs (capped to `limit`).
 *
 * Uses the `/lei-records?filter[entity.legalName]=…` search, which does a
 * contains-match over legal names. (The older `/fuzzycompletions` autocomplete
 * endpoint now returns empty for ordinary company names, so it is not used.)
 * Results are adapted to the {@link FuzzyMatch} shape the mapper expects.
 */
export async function fuzzyByName(
  config: TransportConfig,
  name: string,
  limit: number,
): Promise<FuzzyMatch[]> {
  const url = new URL(`${config.baseUrl}/lei-records`)
  url.searchParams.set("filter[entity.legalName]", name)
  url.searchParams.set("page[size]", String(Math.max(1, Math.min(limit, 100))))
  const res = await doFetch(url.toString(), config.timeoutMs)
  if (!res.ok) {
    throw await toHttpError(res)
  }
  const parsed = leiRecordListResponseSchema.parse(await res.json())
  return parsed.data.slice(0, limit).map((rec) => ({
    type: "fuzzycompletions" as const,
    attributes: { value: rec.attributes.entity.legalName.name },
    relationships: { "lei-records": { data: { id: rec.attributes.lei } } },
  }))
}

/** GET a single LEI record. 404 -> null (no such entity). */
export async function getLeiRecord(config: TransportConfig, lei: string): Promise<LeiRecord | null> {
  return getRecordAt(config, `/lei-records/${encodeURIComponent(lei)}`)
}

/** GET the direct/ultimate parent's full record. 404 -> null (no parent reported). */
export async function getParentRecord(
  config: TransportConfig,
  lei: string,
  kind: "direct" | "ultimate",
): Promise<LeiRecord | null> {
  return getRecordAt(config, `/lei-records/${encodeURIComponent(lei)}/${kind}-parent`)
}

async function getRecordAt(config: TransportConfig, path: string): Promise<LeiRecord | null> {
  const res = await doFetch(`${config.baseUrl}${path}`, config.timeoutMs)
  if (res.status === 404) {
    return null
  }
  if (!res.ok) {
    throw await toHttpError(res)
  }
  const json = (await res.json()) as { data?: { type?: string } }
  // GLEIF can answer "no parent reported" with 200 + a reporting-exceptions
  // envelope instead of 404; treat any non-lei-records payload as "no record".
  if (json?.data?.type && json.data.type !== "lei-records") {
    return null
  }
  return leiRecordResponseSchema.parse(json).data
}

async function toHttpError(res: Response): Promise<GleifHttpError> {
  const body = await safeBody(res)
  if (res.status === 429) {
    return new GleifRateLimitError(res.status, body)
  }
  return new GleifHttpError(res.status, body)
}

async function safeBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300)
  } catch {
    return ""
  }
}
