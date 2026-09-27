import { afterEach, describe, expect, it, vi } from "vitest"
import { TokenManager } from "../src/auth"
import { CopernicusTokenError } from "../src/errors"

function tokenBody(token: string, expiresIn: number) {
  return JSON.stringify({ access_token: token, expires_in: expiresIn, token_type: "Bearer" })
}

function stub(fn: (...args: unknown[]) => Promise<Response>) {
  const f = vi.fn(fn)
  vi.stubGlobal("fetch", f)
  return f
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const manager = () =>
  new TokenManager({ clientId: "id", clientSecret: "secret", tokenEndpoint: "https://t.test/token" })

describe("TokenManager", () => {
  it("exchanges client credentials for a bearer token", async () => {
    const f = stub(async () => new Response(tokenBody("tok-1", 600), { status: 200 }))
    const m = manager()
    expect(await m.getToken()).toBe("tok-1")
    const body = String(f.mock.calls[0]?.[1] && (f.mock.calls[0][1] as RequestInit).body)
    expect(body).toContain("grant_type=client_credentials")
    expect(body).toContain("client_id=id")
  })

  it("reuses a cached token instead of re-minting", async () => {
    const f = stub(async () => new Response(tokenBody("tok-1", 600), { status: 200 }))
    const m = manager()
    await m.getToken()
    await m.getToken()
    expect(f).toHaveBeenCalledTimes(1)
  })

  it("coalesces concurrent refreshes into one exchange", async () => {
    const f = stub(async () => new Response(tokenBody("tok-1", 600), { status: 200 }))
    const m = manager()
    const [a, b] = await Promise.all([m.getToken(), m.getToken()])
    expect(a).toBe("tok-1")
    expect(b).toBe("tok-1")
    expect(f).toHaveBeenCalledTimes(1)
  })

  it("re-mints after invalidate()", async () => {
    let n = 0
    const f = stub(async () => new Response(tokenBody(`tok-${++n}`, 600), { status: 200 }))
    const m = manager()
    expect(await m.getToken()).toBe("tok-1")
    m.invalidate()
    expect(await m.getToken()).toBe("tok-2")
    expect(f).toHaveBeenCalledTimes(2)
  })

  it("refreshes when the cached token is within the expiry skew", async () => {
    let n = 0
    // expires_in=30 is below the 60s skew, so the token is treated as already stale.
    const f = stub(async () => new Response(tokenBody(`tok-${++n}`, 30), { status: 200 }))
    const m = manager()
    await m.getToken()
    await m.getToken()
    expect(f).toHaveBeenCalledTimes(2)
  })

  it("throws CopernicusTokenError on a non-2xx exchange", async () => {
    stub(async () => new Response("bad creds", { status: 401 }))
    await expect(manager().getToken()).rejects.toBeInstanceOf(CopernicusTokenError)
  })
})
