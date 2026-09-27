import { describe, it, expect, vi } from "vitest"
import { identifyVessel } from "./identify"
import type { ShipInfo } from "@talasa/equasis"

function shipInfo(over: Partial<ShipInfo["particulars"]> = {}): ShipInfo {
  return {
    particulars: {
      imo: "9304162", name: "SUBJECT", flag: "Gabon", callSign: "ABCD", mmsi: "123456789",
      grossTonnage: 50000, deadweight: 90000, shipType: "Crude Oil Tanker", yearOfBuild: "2006",
      status: "In Service", lastUpdate: null, ...over,
    },
    overview: { classedByIacs: false, detentionRate: "12 %", parisMou: "Black (High risk)", tokyoMou: null, usCoastGuard: null },
    management: [
      { companyImo: "5553502", role: "Registered owner", name: "OWNER CO", address: "Piraeus", dateOfEffect: null },
      { companyImo: "6161661", role: "ISM Manager", name: "MGR CO", address: "Athens", dateOfEffect: null },
      { companyImo: null, role: "Operator", name: "OP CO", address: null, dateOfEffect: null },
    ],
    geography: [],
  }
}

describe("identifyVessel", () => {
  it("maps particulars + overview to identity and tags a risky flag", async () => {
    const c = { equasis: { getShipByImo: vi.fn(async () => shipInfo()) } } as any
    const { identity, companies } = await identifyVessel({ imo: "9304162" }, c)
    expect(identity.imo).toBe("9304162")
    expect(identity.flag).toBe("Gabon")
    expect(identity.riskyFlag).toBe(true)
    expect(identity.detentionRate).toBe("12 %")
    expect(identity.parisMou).toBe("Black (High risk)")
    // Only management companies with a companyImo + a management role survive
    expect(companies.map((m) => m.companyImo)).toEqual(["5553502", "6161661"])
  })
  it("does not tag a normal flag as risky", async () => {
    const c = { equasis: { getShipByImo: vi.fn(async () => shipInfo({ flag: "Panama" })) } } as any
    const { identity } = await identifyVessel({ imo: "9304162" }, c)
    expect(identity.riskyFlag).toBe(false)
  })
})
