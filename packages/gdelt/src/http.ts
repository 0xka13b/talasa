import { DOC_PATH } from "./constants"
import { GdeltHttpError, GdeltQueryError, GdeltRateLimitError } from "./errors"

export interface TransportConfig {
  baseUrl: string
}

/**
 * GET the DOC endpoint and return the parsed JSON body.
 *
 * The free DOC API is quirky: it has no auth, and on a bad query OR a rate-limit
 * trip it replies with a plain-text message — frequently at HTTP 200, not 4xx.
 * So success is determined by the body, not just the status code.
 */
export async function getDoc(config: TransportConfig, params: URLSearchParams): Promise<unknown> {
  const url = new URL(DOC_PATH, config.baseUrl)
  url.search = params.toString()

  const res = await fetch(url, { headers: { Accept: "application/json" } })
  const text = await res.text()

  if (res.status === 429) {
    throw new GdeltRateLimitError(snippet(text))
  }

  const parsed = tryParseJson(text)
  if (parsed !== undefined) {
    if (!res.ok) {
      throw new GdeltHttpError(res.status, snippet(text))
    }
    return parsed
  }

  // Body is not JSON. Either an upstream error page (non-2xx) or one of GDELT's
  // plain-text notices returned at HTTP 200.
  if (!res.ok) {
    throw new GdeltHttpError(res.status, snippet(text))
  }
  if (isRateLimitNotice(text)) {
    throw new GdeltRateLimitError(snippet(text))
  }
  throw new GdeltQueryError(snippet(text))
}

function tryParseJson(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return undefined
  }
  try {
    return JSON.parse(trimmed)
  } catch {
    return undefined
  }
}

function isRateLimitNotice(text: string): boolean {
  return /limit requests|one every|too many requests/i.test(text)
}

/** First line of a plain-text body, trimmed, for an error message. */
function snippet(text: string): string {
  const line = text.trim().split("\n")[0] ?? ""
  return line.length > 200 ? `${line.slice(0, 200)}…` : line || "empty response"
}
