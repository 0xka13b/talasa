import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { extractCompanyResults } from "../src/parse/company"

const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(here, "fixtures/company-search.html"), "utf8")

describe("extractCompanyResults", () => {
  const results = extractCompanyResults(html)

  it("parses one de-duplicated company row", () => {
    expect(results).toHaveLength(1)
    const [company] = results
    expect(company?.id).toBe("6161661")
    expect(company?.name).toBe("HAI KUO SHIPPING 1984B LTD")
    expect(company?.address).toContain("Piraeus")
  })

  it("returns an empty list when there are no results", () => {
    expect(extractCompanyResults("<html><body>no results</body></html>")).toEqual([])
  })
})
