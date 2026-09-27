import { describe, it, expect, vi } from "vitest"
import { expandFleet } from "./fleet"
import type { ManagementCompany } from "./types"

const companies: ManagementCompany[] = [
  { companyImo: "5553502", role: "Registered owner", roles: ["Registered owner"], name: "OWNER CO", address: null },
]

function shipInfoFor(imo: string) {
  return {
    particulars: { imo, name: `SHIP ${imo}`, flag: "Panama", callSign: null, mmsi: null, grossTonnage: null, deadweight: null, shipType: "Tanker", yearOfBuild: null, status: null, lastUpdate: null },
    overview: { classedByIacs: true, detentionRate: null, parisMou: null, tokyoMou: null, usCoastGuard: null },
    management: [],
  }
}

describe("expandFleet", () => {
  it("collects sisters, caps full-page fetches, and flags truncation", async () => {
    const fleetImos = ["1111111", "2222222", "3333333", "9304162"] // includes the subject
    const c = {
      equasis: {
        getCompanyFleet: vi.fn(async () => ({ companyImo: "5553502", name: "OWNER CO", vessels: fleetImos.map((imo) => ({ imo, name: `LIST ${imo}`, flag: "Panama", type: "Tanker" })) })),
        getShipByImo: vi.fn(async (imo: string) => shipInfoFor(imo)),
      },
    } as any
    const result = await expandFleet("9304162", companies, c, { maxSistersPerCompany: 2, maxSisterPages: 2 })
    // Subject excluded; the other three are sisters
    expect(result.sisters.map((s) => s.imo).sort()).toEqual(["1111111", "2222222", "3333333"])
    // Only 2 full ship pages fetched (cap)
    expect(c.equasis.getShipByImo).toHaveBeenCalledTimes(2)
    expect(result.truncated).toBe(true)
    expect(result.note).toContain("not detailed")
    expect(result.companies[0]!.sampledCount).toBe(2)
    expect(result.companies[0]!.vesselCount).toBe(4)
  })
  it("continues past a company whose fleet fetch fails", async () => {
    const c = { equasis: { getCompanyFleet: vi.fn(async () => { throw new Error("boom") }), getShipByImo: vi.fn() } } as any
    const result = await expandFleet("9304162", companies, c, { maxSistersPerCompany: 25, maxSisterPages: 60 })
    expect(result.sisters).toEqual([])
    expect(result.companies).toEqual([])
  })
})
