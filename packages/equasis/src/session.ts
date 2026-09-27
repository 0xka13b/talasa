import { EQUASIS_ORIGIN } from "./constants"
import { EquasisHttpError } from "./errors"

export interface SessionConfig {
  email: string
  password: string
  baseUrl: string
  userAgent: string
}

/**
 * Owns the Equasis `JSESSIONID`. Login is two steps: GET a public page to be
 * issued a session cookie, then POST credentials to upgrade that same session to
 * authenticated (Equasis does not rotate the id on login). The cookie is cached
 * and only re-fetched when {@link invalidate} is called (on detected expiry).
 */
export class EquasisSession {
  private cookie: string | null = null

  constructor(private readonly config: SessionConfig) {}

  get baseUrl(): string {
    return this.config.baseUrl
  }

  get userAgent(): string {
    return this.config.userAgent
  }

  /** Returns the active session cookie, logging in first if needed. */
  async getCookie(): Promise<string> {
    if (this.cookie === null) {
      await this.login()
    }
    if (this.cookie === null) {
      throw new EquasisHttpError(0, "login did not yield a session cookie")
    }
    return this.cookie
  }

  /** Drop the cached session so the next {@link getCookie} re-logins. */
  invalidate(): void {
    this.cookie = null
  }

  /** Perform the two-step login and cache the resulting session cookie. */
  async login(): Promise<void> {
    const seedRes = await fetch(`${this.config.baseUrl}/public/HomePage?fs=HomePage`, {
      headers: { "User-Agent": this.config.userAgent },
    })
    const seedCookie = readJsessionid(seedRes.headers)
    if (seedCookie === null) {
      throw new EquasisHttpError(seedRes.status, "could not seed a session cookie")
    }

    const loginRes = await fetch(`${this.config.baseUrl}/authen/HomePage?fs=HomePage`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": this.config.userAgent,
        Origin: EQUASIS_ORIGIN,
        Referer: `${this.config.baseUrl}/public/HomePage?fs=HomePage`,
        Cookie: seedCookie,
      },
      body: new URLSearchParams({
        j_email: this.config.email,
        j_password: this.config.password,
        submit: "",
      }),
    })

    // The seed session is upgraded in place; honour a rotated cookie if present.
    this.cookie = readJsessionid(loginRes.headers) ?? seedCookie
  }
}

function readJsessionid(headers: Headers): string | null {
  const setCookies = headers.getSetCookie?.() ?? []
  for (const entry of setCookies) {
    const match = /JSESSIONID=([^;]+)/.exec(entry)
    if (match) {
      return `JSESSIONID=${match[1]}`
    }
  }
  return null
}
