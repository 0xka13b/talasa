import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { extractShipInspections } from "../src/parse/inspection"

const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(here, "fixtures/ship-inspection.html"), "utf8")
const result = extractShipInspections(html, "9304162")

describe("extractShipInspections", () => {
  it("carries the requested IMO", () => {
    expect(result.imo).toBe("9304162")
  })

  it("parses every PSC inspection event (one row per inspecting authority report)", () => {
    // The fixture's PSC table has 51 primary inspection rows (the 3 rowspan
    // continuation rows for a second MOU report are not standalone events).
    expect(result.inspections).toHaveLength(51)
  })

  it("parses a known not-detained inspection with deficiencies", () => {
    const row = result.inspections.find(
      (i) => i.date === "15/12/2025" && i.authority === "Romania",
    )
    expect(row).toBeDefined()
    expect(row?.port).toBe("Constanta")
    expect(row?.detained).toBe(false)
    expect(row?.deficiencies).toBe(2)
  })

  it("parses the most recent inspection (no deficiencies recorded)", () => {
    const row = result.inspections.find(
      (i) => i.date === "10/04/2026" && i.authority === "Ukraine",
    )
    expect(row).toBeDefined()
    expect(row?.port).toBe("Pivdennyi")
    expect(row?.detained).toBe(false)
    expect(row?.deficiencies).toBeNull()
  })

  it("treats every inspection in this vessel's clean history as not detained", () => {
    expect(result.inspections.every((i) => i.detained === false)).toBe(true)
  })

  it("tolerates older rows with no authority/port but keeps the date", () => {
    const row = result.inspections.find((i) => i.date === "09/10/2007")
    expect(row).toBeDefined()
    expect(row?.authority).toBeNull()
    expect(row?.port).toBeNull()
  })

  it("returns an empty list (no throw) for an unrelated page", () => {
    const empty = extractShipInspections("<html><body>nope</body></html>", "9304162")
    expect(empty.inspections).toEqual([])
  })

  it("parses a detained row (Detention cell = Y) as detained: true", () => {
    // Synthetic table — the real fixture has only not-detained rows, so this
    // locks the detained predicate that downstream detentions mapping relies on.
    const synthetic = `
      <html><body>
        <table class="tableLSDD">
          <thead><tr>
            <th>Authority</th><th>Port of inspection</th><th>Date of report</th>
            <th>Detention</th><th>PSC Organisation</th><th>Type of inspection</th>
            <th>Duration (days)</th><th>Number of deficiencies</th><th>Details</th>
          </tr></thead>
          <tbody><tr>
            <td>Panama</td><td>Balboa</td><td>01/01/2026</td>
            <td>Y</td><td>Tokyo MoU</td><td>Initial</td>
            <td>1</td><td>7</td><td></td>
          </tr></tbody>
        </table>
      </body></html>`
    const detained = extractShipInspections(synthetic, "9304162")
    expect(detained.inspections).toHaveLength(1)
    expect(detained.inspections[0]?.detained).toBe(true)
    expect(detained.inspections[0]?.deficiencies).toBe(7)
  })
})
