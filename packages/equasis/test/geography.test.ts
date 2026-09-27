import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { extractGeography } from "../src/parse/geography"
import { parseHtml } from "../src/parse/html"
import { extractShipInfo } from "../src/parse/ship"

const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(here, "fixtures/ship-info.html"), "utf8")
const ship = extractShipInfo(html, "1059632")

describe("extractGeography", () => {
  it("exposes geography on the parsed ShipInfo", () => {
    // Fixture "Geographical Information" table: 15 sighting rows.
    expect(ship.geography).toHaveLength(15)
  })

  it("parses the most recent sighting (date / area / source)", () => {
    const row = ship.geography[0]
    expect(row?.date).toBe("June 2026")
    expect(row?.area).toBe("Middle America and Gulf of Mexico")
    expect(row?.source).toBe("MarineTraffic")
  })

  it("keeps a multi-zone area as a single comma-joined string", () => {
    const row = ship.geography.find((g) => g.source === "AXS Marine" && g.date === "March 2026")
    expect(row?.area).toBe("Malacca Strait, Singapore Strait, South China Sea")
  })

  it("attributes rows to each tracking source", () => {
    const sources = ship.geography.map((g) => g.source)
    expect(sources.filter((s) => s === "MarineTraffic")).toHaveLength(7)
    expect(sources.filter((s) => s === "VesselTracker")).toHaveLength(6)
    expect(sources.filter((s) => s === "AXS Marine")).toHaveLength(2)
  })

  it("ignores the sibling management tableLS on the same page", () => {
    // The management grid is also a `tableLS`; none of its company names leak in as areas.
    expect(ship.geography.some((g) => g.area?.includes("HAI KUO"))).toBe(false)
  })

  it("returns an empty list (no throw) for a page without the section", () => {
    const $ = parseHtml("<html><body>nope</body></html>")
    expect(extractGeography($)).toEqual([])
  })

  it("parses a synthetic geography table by its header", () => {
    const $ = parseHtml(`
      <html><body>
        <table class="tableLS">
          <thead><tr>
            <th data-field="Date of record">Date of record</th>
            <th data-field="Area where the ship was seen">Area where the ship was seen</th>
            <th data-field="Source">Source</th>
          </tr></thead>
          <tbody><tr>
            <td>July 2026</td><td>West Europe</td><td>VesselTracker</td>
          </tr></tbody>
        </table>
      </body></html>`)
    const rows = extractGeography($)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({ date: "July 2026", area: "West Europe", source: "VesselTracker" })
  })
})
