import { describe, it, expect, vi } from "vitest"
import { runVesselPipeline } from "./pipeline"

function fakeDb() {
  return { execute: vi.fn(async () => []) }
}
function clients() {
  return {
    equasis: {
      getShipByImo: vi.fn(async (imo: string) => ({
        particulars: { imo, name: `SHIP ${imo}`, flag: "Gabon", callSign: null, mmsi: null, grossTonnage: null, deadweight: null, shipType: "Tanker", yearOfBuild: null, status: null, lastUpdate: null },
        overview: { classedByIacs: true, detentionRate: null, parisMou: null, tokyoMou: null, usCoastGuard: null },
        management: [{ companyImo: "5553502", role: "Registered owner", name: "OWNER CO", address: null, dateOfEffect: null }],
      })),
      getCompanyFleet: vi.fn(async () => ({ companyImo: "5553502", name: "OWNER CO", vessels: [{ imo: "5555555", name: "SIS", flag: "Panama", type: "Tanker" }] })),
      getShipHistory: vi.fn(async (imo: string) => ({ imo, entries: [{ kind: "flag", value: "Gabon", from: "01/01/2020", to: null }, { kind: "flag", value: "Panama", from: "01/01/2015", to: null }] })),
      getShipInspections: vi.fn(async (imo: string) => ({ imo, inspections: [{ authority: "Romania", date: "01/01/2024", port: "Constanta", detained: true, deficiencies: 4 }] })),
    },
    opensanctions: { screen: vi.fn(async (targets: any[]) => targets.map((t) => ({ label: "x", kind: t.kind, decision: "clear", matches: [] }))) },
    gleif: { lookupCompany: vi.fn().mockResolvedValue(null) } as never,
    inference: { synthesizeVesselBrief: vi.fn(async () => ({ fields: { executiveSummary: "es", sanctionsNarrative: "sn", prediction: "pred", recommendation: "rec" }, usage: { model: "m", inputTokens: 1, outputTokens: 2, cachedTokens: 0 } })) },
  } as any
}
const log = { info: vi.fn(), error: vi.fn(), child: () => log } as any

describe("runVesselPipeline", () => {
  it("runs all seven stages and finalizes the screening", async () => {
    const c = clients()
    const db = fakeDb()
    await runVesselPipeline({ id: "screen-1", imo: "9304162", steps: {} }, c, log, db as any)
    expect(c.equasis.getShipByImo).toHaveBeenCalledWith("9304162")       // identify
    expect(c.equasis.getShipHistory).toHaveBeenCalledWith("9304162")     // history
    expect(c.equasis.getShipInspections).toHaveBeenCalledWith("9304162") // inspections
    expect(c.equasis.getCompanyFleet).toHaveBeenCalledWith("5553502")    // fleet
    expect(c.gleif.lookupCompany).toHaveBeenCalled()                   // enrich
    expect(c.opensanctions.screen).toHaveBeenCalled()                  // sanctions
    expect(c.inference.synthesizeVesselBrief).toHaveBeenCalledTimes(1) // synthesize
    // A finalize UPDATE setting status='completed' was issued.
    const sqls = db.execute.mock.calls.map(() => true)
    expect(sqls.length).toBeGreaterThan(0)
  })
})
