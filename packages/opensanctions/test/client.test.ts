import { afterEach, describe, expect, it, vi } from "vitest"
import { OpenSanctionsClient } from "../src/client"
import { OpenSanctionsConfigError } from "../src/errors"

const EMPTY_MATCH = { responses: {} }

function stubFetch() {
  const fetchMock = vi.fn(
    async (_url: string | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(EMPTY_MATCH), { status: 200 }),
  )
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

function authHeader(fetchMock: ReturnType<typeof stubFetch>): string | undefined {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
  return (init?.headers as Record<string, string> | undefined)?.Authorization
}

afterEach(() => vi.unstubAllGlobals())

describe("api key", () => {
  it("is required for the hosted API", () => {
    expect(() => new OpenSanctionsClient({ apiKey: "" })).toThrow(OpenSanctionsConfigError)
    expect(
      () => new OpenSanctionsClient({ apiKey: "", baseUrl: "https://api.opensanctions.org/" }),
    ).toThrow(OpenSanctionsConfigError)
  })

  it("is optional for a self-hosted yente, and no Authorization header is sent", async () => {
    const fetchMock = stubFetch()
    const client = new OpenSanctionsClient({ apiKey: "", baseUrl: "http://localhost:8000" })
    await client.screen([{ kind: "vessel", imo: "9298595" }])
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(authHeader(fetchMock)).toBeUndefined()
  })

  it("is sent as an ApiKey header when configured", async () => {
    const fetchMock = stubFetch()
    const client = new OpenSanctionsClient({ apiKey: "k", baseUrl: "http://localhost:8000" })
    await client.screen([{ kind: "vessel", imo: "9298595" }])
    expect(authHeader(fetchMock)).toBe("ApiKey k")
  })
})
