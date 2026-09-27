import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  DatalasticAuthError,
  DatalasticConfigError,
  DatalasticError,
  DatalasticHttpError,
  DatalasticRateLimitError,
  DatalasticTimeoutError,
} from "../src/errors"
import {
  fetchVessel,
  fetchVesselHistory,
  fetchVesselInfo,
  fetchVesselsInRadius,
  selectorParams,
} from "../src/http"
import type { TransportConfig } from "../src/http"

const here = dirname(fileURLToPath(import.meta.url))
const raw = (name: string) => readFileSync(join(here, "fixtures", name), "utf8")

const config: TransportConfig = {
  baseUrl: "https://api.datalastic.com/api/v0",
  apiKey: "test-key",
  timeoutMs: 5000,
}

function stub(status: number, body: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(body, { status })),
  )
}

/** Capture the URL string passed to a 200-returning fetch stub. */
function captureUrl(body: string): () => string {
  const f = vi.fn(async (..._args: unknown[]) => new Response(body, { status: 200 }))
  vi.stubGlobal("fetch", f)
  return () => String(f.mock.calls[0]?.[0])
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe("selectorParams", () => {
  it("accepts exactly one identifier", () => {
    expect(selectorParams({ imo: "9298595" })).toEqual({ imo: "9298595" })
    expect(selectorParams({ mmsi: "613271707" })).toEqual({ mmsi: "613271707" })
  })

  it("rejects zero identifiers", () => {
    expect(() => selectorParams({} as never)).toThrow(DatalasticConfigError)
  })

  it("rejects more than one identifier", () => {
    expect(() => selectorParams({ imo: "9298595", mmsi: "613271707" } as never)).toThrow(
      DatalasticConfigError,
    )
  })
})

describe("doFetch timeout", () => {
  it("rejects with DatalasticTimeoutError when the request exceeds timeoutMs", async () => {
    vi.useFakeTimers()
    const f = vi.fn(
      (_url: unknown, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"))
          })
        }),
    )
    vi.stubGlobal("fetch", f)
    const fast: TransportConfig = { ...config, timeoutMs: 10 }
    const promise = fetchVessel(fast, { imo: "9298595" }, true)
    const assertion = expect(promise).rejects.toBeInstanceOf(DatalasticTimeoutError)
    await vi.advanceTimersByTimeAsync(10)
    await assertion
    await expect(promise).rejects.toBeInstanceOf(DatalasticError)
  })
})

describe("fetchVessel", () => {
  it("parses /vessel_pro on 200", async () => {
    stub(200, raw("vessel_pro.json"))
    const v = await fetchVessel(config, { imo: "9298595" }, true)
    expect(v?.name).toBe("DORRY")
    expect(v?.current_draught).toBe("9.2")
  })

  it("attaches api-key, selector and the pro path", async () => {
    const url = captureUrl(raw("vessel_pro.json"))
    await fetchVessel(config, { imo: "9298595" }, true)
    expect(url()).toContain("/vessel_pro")
    expect(url()).toContain("api-key=test-key")
    expect(url()).toContain("imo=9298595")
  })

  it("uses the basic /vessel path when not pro", async () => {
    const url = captureUrl(raw("vessel_pro.json"))
    await fetchVessel(config, { mmsi: "613271707" }, false)
    expect(url()).toContain("/vessel?")
    expect(url()).not.toContain("/vessel_pro")
    expect(url()).toContain("mmsi=613271707")
  })

  it("returns null on 404 (unknown vessel)", async () => {
    stub(404, '{"meta":{"success":false}}')
    expect(await fetchVessel(config, { imo: "0000000" }, true)).toBeNull()
  })

  it("throws DatalasticAuthError on 401 and 403", async () => {
    stub(401, "invalid api key")
    await expect(fetchVessel(config, { imo: "9298595" }, true)).rejects.toBeInstanceOf(
      DatalasticAuthError,
    )
    stub(403, "endpoint not in plan")
    await expect(fetchVessel(config, { imo: "9298595" }, true)).rejects.toBeInstanceOf(
      DatalasticAuthError,
    )
  })

  it("throws DatalasticRateLimitError on 429", async () => {
    stub(429, "slow down")
    await expect(fetchVessel(config, { imo: "9298595" }, true)).rejects.toBeInstanceOf(
      DatalasticRateLimitError,
    )
  })

  it("throws DatalasticHttpError on 500", async () => {
    stub(500, "boom")
    await expect(fetchVessel(config, { imo: "9298595" }, true)).rejects.toBeInstanceOf(
      DatalasticHttpError,
    )
  })
})

describe("fetchVesselInfo", () => {
  it("parses static specs", async () => {
    stub(200, raw("vessel_info.json"))
    const info = await fetchVesselInfo(config, { imo: "9298595" })
    expect(info?.callsign).toBe("TJMOE5")
    expect(info?.draught_max).toBe(9.62)
  })
})

describe("fetchVesselHistory", () => {
  it("parses the position track", async () => {
    stub(200, raw("vessel_history.json"))
    const track = await fetchVesselHistory(config, { imo: "9298595" }, { days: 90 })
    expect(track?.positions).toHaveLength(2)
  })

  it("passes days and honours an explicit from/to window", async () => {
    const url = captureUrl(raw("vessel_history.json"))
    await fetchVesselHistory(config, { imo: "9298595" }, { days: 90 })
    expect(url()).toContain("days=90")

    const url2 = captureUrl(raw("vessel_history.json"))
    await fetchVesselHistory(config, { imo: "9298595" }, { from: "2026-01-01", to: "2026-03-01" })
    expect(url2()).toContain("from=2026-01-01")
    expect(url2()).toContain("to=2026-03-01")
    expect(url2()).not.toContain("days=")
  })
})

describe("fetchVesselsInRadius", () => {
  it("parses the vessel list and sends lat/lon/radius", async () => {
    const url = captureUrl(raw("vessel_inradius.json"))
    const scan = await fetchVesselsInRadius(config, { lat: 14.5, lon: -17.6, radius: 10 })
    expect(scan?.vessels).toHaveLength(2)
    expect(url()).toContain("lat=14.5")
    expect(url()).toContain("lon=-17.6")
    expect(url()).toContain("radius=10")
  })

  it("forwards optional type filters", async () => {
    const url = captureUrl(raw("vessel_inradius.json"))
    await fetchVesselsInRadius(config, {
      lat: 14.5,
      lon: -17.6,
      radius: 10,
      type: "Tanker",
      typeSpecific: "Crude Oil Tanker",
    })
    expect(url()).toContain("type=Tanker")
    expect(url()).toContain("type_specific=Crude+Oil+Tanker")
  })
})
