import { describe, it, expect, vi } from "vitest"
import { fetchVesselInspections, summariseInspections } from "./inspections"
import type { Inspection } from "@talasa/equasis"

function insp(over: Partial<Inspection>): Inspection {
  return { authority: "Romania", date: "01/01/2024", port: "Constanta", detained: false, deficiencies: null, ...over }
}

describe("summariseInspections", () => {
  it("counts reports, detentions and total deficiencies", () => {
    const s = summariseInspections([
      insp({ detained: true, deficiencies: 12 }),
      insp({ detained: false, deficiencies: 3 }),
      insp({ detained: false, deficiencies: null }),
    ])
    expect(s.total).toBe(3)
    expect(s.detentions).toBe(1)
    expect(s.deficiencies).toBe(15)
    expect(s.records).toHaveLength(3)
    expect(s.records[0]).toEqual({ authority: "Romania", date: "01/01/2024", port: "Constanta", detained: true, deficiencies: 12 })
  })

  it("returns zeroed totals for a vessel with no inspection rows", () => {
    expect(summariseInspections([])).toEqual({ total: 0, detentions: 0, deficiencies: 0, records: [] })
  })
})

describe("fetchVesselInspections", () => {
  it("fetches by IMO and summarises the parsed rows", async () => {
    const getShipInspections = vi.fn(async () => ({
      imo: "9304162",
      inspections: [insp({ detained: true, deficiencies: 5 }), insp({ deficiencies: 2 })],
    }))
    const s = await fetchVesselInspections("9304162", { equasis: { getShipInspections } } as never)
    expect(getShipInspections).toHaveBeenCalledWith("9304162")
    expect(s.total).toBe(2)
    expect(s.detentions).toBe(1)
    expect(s.deficiencies).toBe(7)
  })
})
