import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { extractShipHistory } from "../src/parse/history"

const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(here, "fixtures/ship-history.html"), "utf8")
const result = extractShipHistory(html, "9304162")

describe("extractShipHistory", () => {
  it("carries the requested IMO", () => {
    expect(result.imo).toBe("9304162")
  })

  it("parses every change row across the name/flag/class/company tables", () => {
    // Fixture: 2 name + 5 flag + 5 classification + 6 company rows = 18.
    expect(result.entries).toHaveLength(18)
  })

  it("parses the current ship name with its effective-from date", () => {
    const row = result.entries.find((e) => e.kind === "name" && e.value === "CHRISTINA B.")
    expect(row).toBeDefined()
    expect(row?.from).toBe("01/03/2012")
    expect(row?.to).toBeNull()
  })

  it("parses each flag change as its own entry", () => {
    const flags = result.entries.filter((e) => e.kind === "flag")
    expect(flags).toHaveLength(5)
    expect(flags.map((f) => f.value)).toContain("Liberia")
  })

  it("derives the company role as the entry kind", () => {
    const owner = result.entries.find(
      (e) => e.value === "SAMAR MARITIME CO LTD",
    )
    expect(owner).toBeDefined()
    expect(owner?.kind).toBe("Registered owner")
    expect(owner?.from).toBe("23/02/2023")
  })

  it("parses a classification-society survey row keyed by survey date", () => {
    const row = result.entries.find(
      (e) => e.kind === "class" && e.from === "19/10/2025",
    )
    expect(row).toBeDefined()
    expect(row?.value).toBe("Nippon Kaiji Kyokai (IACS)")
  })

  it("returns an empty list (no throw) for an unrelated page", () => {
    const empty = extractShipHistory("<html><body>nope</body></html>", "9304162")
    expect(empty.entries).toEqual([])
  })
})
