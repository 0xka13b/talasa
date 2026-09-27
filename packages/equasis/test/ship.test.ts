import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { extractShipInfo } from "../src/parse/ship"

const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(here, "fixtures/ship-info.html"), "utf8")
const ship = extractShipInfo(html, "1059632")

describe("extractShipInfo", () => {
  it("parses identity + particulars", () => {
    expect(ship.particulars.imo).toBe("1059632")
    expect(ship.particulars.name).toBe("NAVE ANTHOS")
    expect(ship.particulars.flag).toBe("Liberia")
    expect(ship.particulars.callSign).toBe("5LZW4")
    expect(ship.particulars.mmsi).toBe("636025941")
    expect(ship.particulars.grossTonnage).toBe(64807)
    expect(ship.particulars.deadweight).toBe(116998)
    expect(ship.particulars.shipType).toBe("Crude Oil Tanker")
    expect(ship.particulars.yearOfBuild).toBe("2026")
  })

  it("parses the compliance overview", () => {
    expect(ship.overview.classedByIacs).toBe(true)
    expect(ship.overview.detentionRate).toBe("0.0%")
    expect(ship.overview.parisMou).toBe("White")
    expect(ship.overview.tokyoMou).toBe("White")
  })

  it("parses the management / ownership chain", () => {
    expect(ship.management.length).toBeGreaterThan(0)

    const owner = ship.management.find((m) => /registered owner/i.test(m.role))
    expect(owner?.name).toBe("HAI KUO SHIPPING 1984B LTD")

    const manager = ship.management.find((m) => /ship manager/i.test(m.role))
    expect(manager?.name).toBe("NAVIOS TANKERS MANAGEMENT INC")
    expect(manager?.companyImo).toBe("5553502")
    expect(manager?.address).toContain("Piraeus")
  })

  it("throws NotFound on an unrelated page", () => {
    expect(() => extractShipInfo("<html><body>nope</body></html>", "1059632")).toThrow()
  })
})
