import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it, vi } from "vitest"
import { GleifClient } from "../src/client"

const here = dirname(fileURLToPath(import.meta.url))
const raw = (name: string) => readFileSync(join(here, "fixtures", name), "utf8")

// Route stubbed fetch by URL to the right fixture. 404 for any unmapped parent.
function routeFetch(overrides: Record<string, { status: number; body: string }> = {}) {
  return vi.fn(async (input: unknown) => {
    const url = String(input)
    for (const [needle, res] of Object.entries(overrides)) {
      if (url.includes(needle)) {
        return new Response(res.body, { status: res.status })
      }
    }
    // Name search: GET /lei-records?filter[entity.legalName]=… (a list).
    if (url.includes("/lei-records") && url.includes("filter")) {
      return new Response(raw("name-search.json"), { status: 200 })
    }
    if (url.includes("/direct-parent")) {
      return new Response(raw("direct-parent.json"), { status: 200 })
    }
    if (url.includes("/ultimate-parent")) {
      return new Response(raw("ultimate-parent.json"), { status: 200 })
    }
    if (url.includes("/lei-records/")) {
      return new Response(raw("lei-record.json"), { status: 200 })
    }
    return new Response("{}", { status: 404 })
  })
}

const client = new GleifClient({ minRequestIntervalMs: 0 })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("lookupCompany", () => {
  it("resolves name -> company + direct/ultimate parents", async () => {
    vi.stubGlobal("fetch", routeFetch())
    const profile = await client.lookupCompany("Société Générale Effekten GmbH")
    expect(profile).not.toBeNull()
    expect(profile?.company.lei).toBe("529900W18LQJJN6SJ336")
    expect(profile?.match.confidence).toBe("exact")
    expect(profile?.directParent).toEqual({
      lei: "O2RNE8IBXP4R0TD8PU41",
      legalName: "SOCIETE GENERALE",
      jurisdiction: "FR",
      relationshipType: "IS_DIRECTLY_CONSOLIDATED_BY",
    })
    expect(profile?.ultimateParent?.relationshipType).toBe("IS_ULTIMATELY_CONSOLIDATED_BY")
  })

  it("flags a non-matching name as fuzzy", async () => {
    vi.stubGlobal("fetch", routeFetch())
    const profile = await client.lookupCompany("Some Other Holding Co")
    expect(profile?.match.confidence).toBe("fuzzy")
  })

  it("returns null parents when no parent is reported (404)", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch({
        "/direct-parent": { status: 404, body: "{}" },
        "/ultimate-parent": { status: 404, body: "{}" },
      }),
    )
    const profile = await client.lookupCompany("Société Générale Effekten GmbH")
    expect(profile?.directParent).toBeNull()
    expect(profile?.ultimateParent).toBeNull()
  })

  it("skips ownership calls when includeOwnership is false", async () => {
    const f = routeFetch()
    vi.stubGlobal("fetch", f)
    const profile = await client.lookupCompany("Société Générale Effekten GmbH", {
      includeOwnership: false,
    })
    expect(profile?.directParent).toBeNull()
    const calledParents = f.mock.calls.some((c) => String(c[0]).includes("-parent"))
    expect(calledParents).toBe(false)
  })

  it("returns null when there is no fuzzy match", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"data":[]}', { status: 200 })),
    )
    expect(await client.lookupCompany("Nonexistent Co")).toBeNull()
  })
})
