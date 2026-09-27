import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DatalasticClient } from "../src/client"
import { DatalasticConfigError } from "../src/errors"

const here = dirname(fileURLToPath(import.meta.url))
const raw = (name: string) => readFileSync(join(here, "fixtures", name), "utf8")

// No throttle delay in tests.
const client = () => new DatalasticClient({ apiKey: "test-key", minRequestIntervalMs: 0 })

function stub(status: number, body: string) {
  const f = vi.fn(async (..._args: unknown[]) => new Response(body, { status }))
  vi.stubGlobal("fetch", f)
  return f
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("constructor", () => {
  it("throws without an api key", () => {
    expect(() => new DatalasticClient({ apiKey: "" })).toThrow(DatalasticConfigError)
    expect(() => new DatalasticClient({ apiKey: "  " })).toThrow(DatalasticConfigError)
  })
})

describe("getVesselPro", () => {
  it("returns a mapped live vessel", async () => {
    stub(200, raw("vessel_pro.json"))
    const v = await client().getVesselPro({ imo: "9298595" })
    expect(v?.name).toBe("DORRY")
    expect(v?.currentDraught).toBe(9.2)
  })

  it("returns null on 404", async () => {
    stub(404, "{}")
    expect(await client().getVesselPro({ imo: "0000000" })).toBeNull()
  })
})

describe("getVesselHistory", () => {
  it("defaults to a 90-day window when none is given", async () => {
    const f = stub(200, raw("vessel_history.json"))
    await client().getVesselHistory({ imo: "9298595" })
    expect(String(f.mock.calls[0]?.[0])).toContain("days=90")
  })

  it("does not inject days when an explicit window is passed", async () => {
    const f = stub(200, raw("vessel_history.json"))
    await client().getVesselHistory({ imo: "9298595" }, { from: "2026-01-01", to: "2026-02-01" })
    const url = String(f.mock.calls[0]?.[0])
    expect(url).not.toContain("days=")
    expect(url).toContain("from=2026-01-01")
  })
})

describe("getVesselsInRadius", () => {
  it("maps the scan", async () => {
    stub(200, raw("vessel_inradius.json"))
    const scan = await client().getVesselsInRadius({ lat: 14.5, lon: -17.6, radiusNm: 10 })
    expect(scan.total).toBe(2)
    expect(scan.vessels).toHaveLength(2)
  })

  it("returns an empty scan on 404 rather than throwing", async () => {
    stub(404, "{}")
    const scan = await client().getVesselsInRadius({ lat: 0, lon: 0, radiusNm: 5 })
    expect(scan.vessels).toEqual([])
    expect(scan.center).toEqual({ lat: 0, lon: 0, radiusNm: 5 })
  })
})
