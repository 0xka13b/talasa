import {
  OpenSanctionsAuthError,
  OpenSanctionsHttpError,
  OpenSanctionsRateLimitError,
} from "./errors"
import type { EntityExample } from "./entity"
import { entityDetailSchema, matchResponseSchema } from "./types"
import type { EntityDetail, MatchResponse } from "./types"

export interface TransportConfig {
  apiKey: string
  baseUrl: string
  dataset: string
  algorithm: string
  threshold: number
  cutoff: number
  limit: number
}

/** POST a batch of FtM example entities to /match and return the parsed response. */
export async function postMatch(
  config: TransportConfig,
  queries: Record<string, EntityExample>,
): Promise<MatchResponse> {
  const url = new URL(`${config.baseUrl}/match/${encodeURIComponent(config.dataset)}`)
  url.searchParams.set("algorithm", config.algorithm)
  url.searchParams.set("threshold", String(config.threshold))
  url.searchParams.set("cutoff", String(config.cutoff))
  url.searchParams.set("limit", String(config.limit))

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(config) },
    body: JSON.stringify({ queries }),
  })
  if (!res.ok) {
    throw await toHttpError(res)
  }
  return matchResponseSchema.parse(await res.json())
}

/** GET a single entity by id (drill-down on a match). */
export async function getEntityById(config: TransportConfig, id: string): Promise<EntityDetail> {
  const url = new URL(`${config.baseUrl}/entities/${encodeURIComponent(id)}`)
  const res = await fetch(url, {
    headers: authHeaders(config),
  })
  if (!res.ok) {
    throw await toHttpError(res)
  }
  return entityDetailSchema.parse(await res.json())
}

/** Self-hosted yente runs without auth, so a blank key sends no header at all. */
function authHeaders(config: TransportConfig): Record<string, string> {
  return config.apiKey ? { Authorization: `ApiKey ${config.apiKey}` } : {}
}

async function toHttpError(res: Response): Promise<OpenSanctionsHttpError> {
  const body = await safeBody(res)
  if (res.status === 401 || res.status === 403) {
    return new OpenSanctionsAuthError(res.status, body)
  }
  if (res.status === 429) {
    return new OpenSanctionsRateLimitError(res.status, body)
  }
  return new OpenSanctionsHttpError(res.status, body)
}

async function safeBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300)
  } catch {
    return ""
  }
}
