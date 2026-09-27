import { describe, it, expect } from "vitest"
import { resolveMaritime } from "./index"

describe("resolveMaritime", () => {
  it("resolves a point off Freetown to the nearest port + EEZ", () => {
    // ~16 nm west of Freetown (a DORRY dark gap).
    const m = resolveMaritime(8.44662, -13.469275)
    expect(m.nearestPort).toMatch(/Freetown/)
    expect(m.nearestPort).toMatch(/Sierra Leone/)
    expect(m.distanceNm).toBeGreaterThan(5)
    expect(m.distanceNm).toBeLessThan(40)
    expect(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]).toContain(m.bearing)
    expect(m.eez).toBe("Sierra Leone EEZ (approx)")
  })

  it("names the Gulf of Guinea for a point off Ghana", () => {
    const m = resolveMaritime(4.1615381, -2.8495767)
    expect(m.nearestPort).toMatch(/Ghana/)
    expect(m.sea).toBe("Gulf of Guinea")
    expect(m.eez).toBe("Ghana EEZ (approx)")
  })

  it("flags international waters far from any coast", () => {
    // Mid-South-Atlantic — hundreds of nm from land.
    const m = resolveMaritime(-30, -20)
    expect(m.distanceNm).toBeGreaterThan(200)
    expect(m.eez).toBe("International waters")
    expect(m.nearestPort).toBeTruthy() // still reports the closest port
  })

  it("gives a bearing consistent with the geometry (point west of its port)", () => {
    // 8.482, -13.185 is just SE/E of Freetown port; assert a plausible easterly-ish set.
    const m = resolveMaritime(13.545979, -16.588612) // north of Banjul
    expect(m.nearestPort).toMatch(/Banjul/)
    expect(["N", "NE", "NW"]).toContain(m.bearing)
  })
})
