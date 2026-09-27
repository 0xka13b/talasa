import { describe, expect, it, vi } from "vitest"
import type { VesselPosition, VesselTrack } from "@talasa/datalastic"
import { analyzeVesselAis } from "./ais"

const H = 3600
const BASE = 1_700_000_000

function pos(hoursFromBase: number, lat: number, lon: number, speed: number | null, nav: string | null = null): VesselPosition {
  const epoch = BASE + Math.round(hoursFromBase * H)
  return { lat, lon, speed, course: null, heading: null, navStatus: nav, destination: null, epoch, timeUtc: new Date(epoch * 1000).toISOString() }
}

function track(positions: VesselPosition[]): VesselTrack {
  return { uuid: null, name: "DORRY", mmsi: "613271707", imo: "9298595", countryIso: "CM", type: "Tanker", typeSpecific: null, positions }
}

/** A fake Clients slice whose Datalastic returns `t`; the mock is returned for assertions. */
function clientReturning(t: VesselTrack | null) {
  const getVesselHistory = vi.fn().mockResolvedValue(t)
  return { c: { datalastic: { getVesselHistory } } as never, getVesselHistory }
}

describe("analyzeVesselAis", () => {
  it("returns available:false when no Datalastic provider is configured", async () => {
    const res = await analyzeVesselAis("9298595", { datalastic: null })
    expect(res.available).toBe(false)
    expect(res.positionCount).toBe(0)
  })

  it("runs the detectors over a fetched track (dark gap in a high-risk zone)", async () => {
    const { c, getVesselHistory } = clientReturning(track([
      pos(0, 44.7, 37.9, 9),
      pos(13, 44.9, 38.1, 0.1), // 13h dark gap into the Black Sea, then stops
      pos(18, 44.9, 38.1, 0.0),
    ]))
    const res = await analyzeVesselAis("9298595", c, { days: 90 })
    expect(getVesselHistory).toHaveBeenCalledWith({ imo: "9298595" }, { days: 90 })
    expect(res.available).toBe(true)
    expect(res.positionCount).toBe(3)
    expect(res.darkGaps).toHaveLength(1)
    expect(res.darkGaps[0]!.highRiskArea).toBe("Novorossiysk (Black Sea)")
  })

  it("treats an unknown vessel (null) as unavailable", async () => {
    const res = await analyzeVesselAis("0000000", clientReturning(null).c)
    expect(res.available).toBe(false)
  })

  it("treats an empty track as unavailable", async () => {
    const res = await analyzeVesselAis("9298595", clientReturning(track([])).c)
    expect(res.available).toBe(false)
  })

  it("propagates provider errors so the stage is marked failed", async () => {
    const c = { datalastic: { getVesselHistory: vi.fn().mockRejectedValue(new Error("boom")) } } as never
    await expect(analyzeVesselAis("9298595", c)).rejects.toThrow("boom")
  })
})
