import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  mapRadiusScan,
  mapVesselInfo,
  mapVesselLive,
  mapVesselTrack,
  num,
  str,
} from "../src/map"
import {
  inRadiusResponseSchema,
  vesselHistoryResponseSchema,
  vesselInfoResponseSchema,
  vesselLiveResponseSchema,
} from "../src/types"

const here = dirname(fileURLToPath(import.meta.url))
const fixture = (name: string) => JSON.parse(readFileSync(join(here, "fixtures", name), "utf8"))

describe("num", () => {
  it("coerces numeric strings, passes numbers, nulls the rest", () => {
    expect(num("9.2")).toBe(9.2)
    expect(num(9.2)).toBe(9.2)
    expect(num("")).toBeNull()
    expect(num(null)).toBeNull()
    expect(num(undefined)).toBeNull()
    expect(num("abc")).toBeNull()
  })
})

describe("str", () => {
  it("trims to a non-empty string or null", () => {
    expect(str(613271707)).toBe("613271707")
    expect(str("  DORRY ")).toBe("DORRY")
    expect(str("")).toBeNull()
    expect(str(null)).toBeNull()
  })
})

describe("mapVesselLive", () => {
  it("maps identity, position and pro draught (numeric-string coerced)", () => {
    const data = vesselLiveResponseSchema.parse(fixture("vessel_pro.json")).data!
    const v = mapVesselLive(data)
    expect(v.imo).toBe("9298595")
    expect(v.mmsi).toBe("613271707")
    expect(v.countryIso).toBe("CM")
    expect(v.currentDraught).toBe(9.2)
    expect(v.destPort).toBe("Pointe Noire")
    expect(v.position.speed).toBe(9.3)
    expect(v.position.epoch).toBe(1751367060)
    expect(v.position.timeUtc).toBe("2026-07-01 10:51:00")
  })
})

describe("mapVesselInfo", () => {
  it("maps specs and empty home_port -> null", () => {
    const data = vesselInfoResponseSchema.parse(fixture("vessel_info.json")).data!
    const info = mapVesselInfo(data)
    expect(info.callSign).toBe("TJMOE5")
    expect(info.deadweight).toBe(21600)
    expect(info.draughtMax).toBe(9.62)
    expect(info.yearBuilt).toBe("2005")
    expect(info.homePort).toBeNull()
  })
})

describe("mapVesselTrack", () => {
  it("maps all fixes, coercing string speed/course", () => {
    const data = vesselHistoryResponseSchema.parse(fixture("vessel_history.json")).data!
    const track = mapVesselTrack(data)
    expect(track.positions).toHaveLength(2)
    expect(track.positions[1]?.speed).toBe(9.3)
    expect(track.positions[1]?.course).toBe(210)
    expect(track.positions[0]?.navStatus).toBe("Moored")
  })
})

describe("mapRadiusScan", () => {
  it("maps centre, total and the co-located DORRY/ELISE pair", () => {
    const data = inRadiusResponseSchema.parse(fixture("vessel_inradius.json")).data!
    const scan = mapRadiusScan(data)
    expect(scan.center).toEqual({ lat: 14.5, lon: -17.6, radiusNm: 10 })
    expect(scan.total).toBe(2)
    expect(scan.vessels.map((v) => v.name)).toEqual(["DORRY", "ELISE"])
    expect(scan.vessels[1]?.distanceNm).toBe(0.9)
  })
})
