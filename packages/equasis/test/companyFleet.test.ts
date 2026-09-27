import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { extractCompanyFleet } from "../src/parse/companyFleet.js"

const html = readFileSync(new URL("./fixtures/company-fleet.html", import.meta.url), "utf8")

describe("extractCompanyFleet", () => {
  it("extracts the company's vessel rows from the FleetInfo page", () => {
    const fleet = extractCompanyFleet(html, "5553502")
    expect(fleet.companyImo).toBe("5553502")
    // NAVIOS page 1 has exactly 42 vessels (verified against the real fixture).
    expect(fleet.vessels.length).toBe(42)
    // Every vessel has a 7-digit IMO and the company's own number is NOT a vessel.
    for (const v of fleet.vessels) expect(v.imo).toMatch(/^\d{7}$/)
    expect(fleet.vessels.some((v) => v.imo === "5553502")).toBe(false)
    // Specific known vessels present with their names (IMO + name share one cell).
    const ohana = fleet.vessels.find((v) => v.imo === "1024481")
    expect(ohana?.name).toContain("NAVE OHANA")
    expect(fleet.vessels.some((v) => v.imo === "1059632")).toBe(true) // NAVE ANTHOS
    // Flag + type columns are populated for at least the first vessel.
    expect(ohana?.flag).toBe("Panama")
    expect(ohana?.type).toContain("Tanker")
  })
  it("returns an empty vessel list without throwing on a fleet-less page", () => {
    const fleet = extractCompanyFleet("<html><body></body></html>", "0000000")
    expect(fleet.vessels).toEqual([])
  })
})
