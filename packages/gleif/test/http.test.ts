import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it, vi } from "vitest"
import { GleifError, GleifHttpError, GleifRateLimitError, GleifTimeoutError } from "../src/errors"
import { fuzzyByName, getLeiRecord, getParentRecord } from "../src/http"
import type { TransportConfig } from "../src/http"

const here = dirname(fileURLToPath(import.meta.url))
const raw = (name: string) => readFileSync(join(here, "fixtures", name), "utf8")

const config: TransportConfig = { baseUrl: "https://api.gleif.org/api/v1", timeoutMs: 5000 }

function stub(status: number, body: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(body, { status })),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe("doFetch timeout", () => {
  it("rejects with GleifTimeoutError when the request exceeds timeoutMs", async () => {
    vi.useFakeTimers()
    // fetch never resolves on its own; it only settles when its signal aborts.
    const f = vi.fn(
      (_url: unknown, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"))
          })
        }),
    )
    vi.stubGlobal("fetch", f)
    const fast: TransportConfig = { baseUrl: "https://api.gleif.org/api/v1", timeoutMs: 10 }
    const promise = getLeiRecord(fast, "X")
    const assertion = expect(promise).rejects.toBeInstanceOf(GleifTimeoutError)
    await vi.advanceTimersByTimeAsync(10)
    await assertion
    await expect(promise).rejects.toBeInstanceOf(GleifError)
  })
})

describe("getLeiRecord", () => {
  it("parses a record on 200", async () => {
    stub(200, raw("lei-record.json"))
    const rec = await getLeiRecord(config, "529900W18LQJJN6SJ336")
    expect(rec?.attributes.lei).toBe("529900W18LQJJN6SJ336")
  })

  it("returns null on 404", async () => {
    stub(404, '{"errors":[]}')
    expect(await getLeiRecord(config, "MISSING")).toBeNull()
  })

  it("throws GleifRateLimitError on 429", async () => {
    stub(429, "slow down")
    await expect(getLeiRecord(config, "X")).rejects.toBeInstanceOf(GleifRateLimitError)
  })

  it("throws GleifHttpError on 500", async () => {
    stub(500, "boom")
    await expect(getLeiRecord(config, "X")).rejects.toBeInstanceOf(GleifHttpError)
  })
})

describe("getParentRecord", () => {
  it("returns null on 404 (no parent reported)", async () => {
    stub(404, "{}")
    expect(await getParentRecord(config, "X", "ultimate")).toBeNull()
  })

  it("returns null on a 200 reporting-exception body (no parent reported)", async () => {
    const f = vi.fn(
      async (_url: unknown) => new Response(raw("reporting-exception.json"), { status: 200 }),
    )
    vi.stubGlobal("fetch", f)
    expect(await getParentRecord(config, "X", "direct")).toBeNull()
  })

  it("hits the kind-specific path", async () => {
    const f = vi.fn(async (_url: unknown) => new Response(raw("direct-parent.json"), { status: 200 }))
    vi.stubGlobal("fetch", f)
    await getParentRecord(config, "529900W18LQJJN6SJ336", "direct")
    expect(String(f.mock.calls[0]?.[0])).toContain("/lei-records/529900W18LQJJN6SJ336/direct-parent")
  })
})

describe("fuzzyByName", () => {
  it("searches lei-records by legal name, caps to limit, and adapts to matches", async () => {
    const f = vi.fn(async (_url: unknown) => new Response(raw("name-search.json"), { status: 200 }))
    vi.stubGlobal("fetch", f)
    const matches = await fuzzyByName(config, "societe generale", 1)
    const decoded = decodeURIComponent(String(f.mock.calls[0]?.[0]))
    expect(decoded).toContain("/lei-records")
    // URLSearchParams encodes the filter key's brackets; spaces become `+`.
    expect(decoded).toContain("filter[entity.legalName]=societe+generale")
    expect(decoded).toContain("page[size]=1")
    expect(matches).toHaveLength(1)
    expect(matches[0]?.relationships?.["lei-records"]?.data?.id).toBe("529900W18LQJJN6SJ336")
    expect(matches[0]?.attributes.value).toBe("Société Générale Effekten GmbH")
  })
})
