import type { TokenManager } from "./auth"
import {
  CopernicusAuthError,
  CopernicusHttpError,
  CopernicusRateLimitError,
  CopernicusTimeoutError,
} from "./errors"

export interface TransportConfig {
  baseUrl: string
  timeoutMs: number
}

async function doFetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    if (controller.signal.aborted) {
      throw new CopernicusTimeoutError(url, timeoutMs)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

async function safeBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500)
  } catch {
    return ""
  }
}

async function toHttpError(res: Response): Promise<CopernicusHttpError> {
  const body = await safeBody(res)
  if (res.status === 401 || res.status === 403) {
    return new CopernicusAuthError(res.status, body)
  }
  if (res.status === 429) {
    return new CopernicusRateLimitError(res.status, body)
  }
  return new CopernicusHttpError(res.status, body)
}

/**
 * POST to a Sentinel Hub path with a bearer token attached, mapping non-2xx to a
 * typed error. On a 401 the cached token is invalidated and the call retried
 * once (a mid-flight expiry shouldn't surface to the caller). The raw {@link
 * Response} is returned so callers can read JSON (catalog) or bytes (process).
 */
export async function authedPost(
  transport: TransportConfig,
  tokens: TokenManager,
  path: string,
  init: { body: string; accept: string; contentType?: string },
): Promise<Response> {
  const url = `${transport.baseUrl}${path}`

  const send = async (): Promise<Response> => {
    const token = await tokens.getToken()
    return doFetch(
      url,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: init.accept,
          ...(init.contentType ? { "Content-Type": init.contentType } : {}),
        },
        body: init.body,
      },
      transport.timeoutMs,
    )
  }

  let res = await send()
  if (res.status === 401) {
    // Token may have expired between mint and use; force one refresh + retry.
    tokens.invalidate()
    res = await send()
  }
  if (!res.ok) {
    throw await toHttpError(res)
  }
  return res
}
