import { EQUASIS_ORIGIN } from "./constants"
import type { EquasisRequest } from "./endpoints"
import { EquasisHttpError, SessionExpiredError } from "./errors"
import type { EquasisSession } from "./session"

/**
 * The single network seam: POST a built request with the active session and
 * return raw HTML. If the response is the login page (session expired mid-use),
 * re-login once and retry before giving up.
 */
export async function scrapePage(
  session: EquasisSession,
  request: EquasisRequest,
): Promise<string> {
  const html = await fetchOnce(session, request)
  if (!isLoginPage(html)) {
    return html
  }

  session.invalidate()
  const retry = await fetchOnce(session, request)
  if (isLoginPage(retry)) {
    throw new SessionExpiredError()
  }
  return retry
}

async function fetchOnce(session: EquasisSession, request: EquasisRequest): Promise<string> {
  const cookie = await session.getCookie()
  const url = `${session.baseUrl}${request.path}`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": session.userAgent,
      Origin: EQUASIS_ORIGIN,
      Referer: `${session.baseUrl}/restricted/Search?fs=HomePage`,
      Cookie: cookie,
    },
    body: new URLSearchParams(request.form),
  })
  if (!res.ok) {
    throw new EquasisHttpError(res.status, url)
  }
  return res.text()
}

function isLoginPage(html: string): boolean {
  return html.includes('name="j_password"') || html.includes('name="formLogin"')
}
