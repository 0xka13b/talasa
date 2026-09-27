import { afterEach, describe, expect, it, vi } from "vitest"
import { CopernicusClient, bboxAround } from "../src/client"
import { CopernicusAuthError, CopernicusConfigError } from "../src/errors"

const TOKEN_BODY = JSON.stringify({ access_token: "tok", expires_in: 600, token_type: "Bearer" })

/**
 * Route fetches by URL: the token endpoint always returns a token; every other
 * URL is answered by `apiHandler`, which receives the request init so tests can
 * assert on the Authorization header and body.
 */
function route(apiHandler: (url: string, init: RequestInit) => Response) {
  const f = vi.fn(async (url: unknown, init?: unknown) => {
    const u = String(url)
    if (u.includes("/token")) {
      return new Response(TOKEN_BODY, { status: 200 })
    }
    return apiHandler(u, (init ?? {}) as RequestInit)
  })
  vi.stubGlobal("fetch", f)
  return f
}

const client = () =>
  new CopernicusClient({
    clientId: "id",
    clientSecret: "secret",
    tokenEndpoint: "https://t.test/token",
    minRequestIntervalMs: 0,
  })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("constructor", () => {
  it("throws without credentials", () => {
    expect(() => new CopernicusClient({ clientId: "", clientSecret: "s" })).toThrow(
      CopernicusConfigError,
    )
    expect(() => new CopernicusClient({ clientId: "i", clientSecret: "  " })).toThrow(
      CopernicusConfigError,
    )
  })
})

describe("bboxAround", () => {
  it("builds a symmetric box around the point", () => {
    const [w, s, e, n] = bboxAround(0, 0, 111.32)
    // At the equator, 111.32 km ≈ 1° in both axes.
    expect(w).toBeCloseTo(-1, 2)
    expect(e).toBeCloseTo(1, 2)
    expect(s).toBeCloseTo(-1, 2)
    expect(n).toBeCloseTo(1, 2)
  })

  it("widens longitude away from the equator", () => {
    const [w, , e] = bboxAround(60, 0, 111.32)
    // cos(60°) = 0.5, so the lon half-width doubles.
    expect(e - w).toBeCloseTo(4, 1)
  })
})

describe("searchScenes", () => {
  it("posts a STAC search with a bearer token and maps items", async () => {
    const f = route(() =>
      new Response(
        JSON.stringify({
          features: [
            {
              id: "S1A_123",
              collection: "sentinel-1-grd",
              bbox: [0, 0, 1, 1],
              properties: { datetime: "2026-06-01T05:00:00Z" },
            },
          ],
        }),
        { status: 200 },
      ),
    )
    const scenes = await client().searchScenes({
      collection: "sentinel-1-grd",
      bbox: [0, 0, 1, 1],
      time: { from: "2026-05-01T00:00:00Z", to: "2026-06-30T00:00:00Z" },
    })
    expect(scenes).toHaveLength(1)
    expect(scenes[0]?.id).toBe("S1A_123")
    expect(scenes[0]?.datetime).toBe("2026-06-01T05:00:00Z")

    const apiCall = f.mock.calls.find(([u]) => String(u).includes("/search"))
    const init = apiCall?.[1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok")
    expect(String(init.body)).toContain('"datetime":"2026-05-01T00:00:00Z/2026-06-30T00:00:00Z"')
  })
})

describe("sarChip", () => {
  it("returns image bytes and the processing-unit cost from the header", async () => {
    const png = new Uint8Array([137, 80, 78, 71])
    route(() =>
      new Response(png, {
        status: 200,
        headers: { "content-type": "image/png", "x-processingunits-spent": "3.5" },
      }),
    )
    const chip = await client().sarChip({
      lat: 25,
      lon: 56,
      radiusKm: 3,
      time: { from: "2026-06-01T00:00:00Z", to: "2026-06-02T00:00:00Z" },
    })
    expect(chip.contentType).toBe("image/png")
    expect(chip.processingUnits).toBe(3.5)
    expect(Array.from(chip.image)).toEqual([137, 80, 78, 71])
  })

  it("null PU when the header is absent", async () => {
    route(() => new Response(new Uint8Array([1]), { status: 200, headers: { "content-type": "image/png" } }))
    const chip = await client().sarChip({
      lat: 0,
      lon: 0,
      radiusKm: 1,
      time: { from: "2026-06-01T00:00:00Z", to: "2026-06-02T00:00:00Z" },
    })
    expect(chip.processingUnits).toBeNull()
  })
})

describe("auth handling", () => {
  it("refreshes the token and retries once on a 401", async () => {
    let apiHits = 0
    const f = route(() => {
      apiHits += 1
      return apiHits === 1
        ? new Response("expired", { status: 401 })
        : new Response(JSON.stringify({ features: [] }), { status: 200 })
    })
    const scenes = await client().searchScenes({
      collection: "sentinel-1-grd",
      bbox: [0, 0, 1, 1],
      time: { from: "2026-05-01T00:00:00Z", to: "2026-06-30T00:00:00Z" },
    })
    expect(scenes).toEqual([])
    // Two token mints (initial + post-invalidate) and two search attempts.
    expect(f.mock.calls.filter(([u]) => String(u).includes("/token"))).toHaveLength(2)
    expect(apiHits).toBe(2)
  })

  it("surfaces a persistent 403 as CopernicusAuthError", async () => {
    route(() => new Response("forbidden", { status: 403 }))
    await expect(
      client().searchScenes({
        collection: "sentinel-1-grd",
        bbox: [0, 0, 1, 1],
        time: { from: "2026-05-01T00:00:00Z", to: "2026-06-30T00:00:00Z" },
      }),
    ).rejects.toBeInstanceOf(CopernicusAuthError)
  })
})
