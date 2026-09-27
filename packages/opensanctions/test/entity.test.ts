import { describe, expect, it } from "vitest"
import { imoQueryValues, targetToExample } from "../src/entity"
import type { ScreenTarget } from "../src/types"

describe("imoQueryValues", () => {
  it("expands a bare IMO into both the bare and IMO-prefixed forms", () => {
    expect(imoQueryValues("9564671")).toEqual(["9564671", "IMO9564671"])
  })

  it("normalizes an already-prefixed value (any case) to avoid double-prefixing", () => {
    expect(imoQueryValues("IMO9564671")).toEqual(["9564671", "IMO9564671"])
    expect(imoQueryValues("imo9564671")).toEqual(["9564671", "IMO9564671"])
  })

  it("trims and returns [] for missing/blank input", () => {
    expect(imoQueryValues("  9564671  ")).toEqual(["9564671", "IMO9564671"])
    expect(imoQueryValues(undefined)).toEqual([])
    expect(imoQueryValues("   ")).toEqual([])
  })
})

describe("targetToExample (vessel IMO query)", () => {
  it("queries imoNumber with both the bare and prefixed identifier so POI entities match", () => {
    const target: ScreenTarget = { kind: "vessel", imo: "9564671" }
    const example = targetToExample(target)
    expect(example.schema).toBe("Vessel")
    expect(example.properties.imoNumber).toEqual(["9564671", "IMO9564671"])
  })

  it("keeps MMSI and other identifiers intact alongside the IMO", () => {
    const target: ScreenTarget = {
      kind: "vessel",
      imo: "9564671",
      mmsi: "311001115",
      name: "PORTOFINO",
    }
    const example = targetToExample(target)
    expect(example.properties.imoNumber).toEqual(["9564671", "IMO9564671"])
    expect(example.properties.mmsi).toEqual(["311001115"])
    expect(example.properties.name).toEqual(["PORTOFINO"])
  })

  it("omits imoNumber entirely for a vessel queried by MMSI only", () => {
    const target: ScreenTarget = { kind: "vessel", mmsi: "311001115" }
    const example = targetToExample(target)
    expect(example.properties.imoNumber).toBeUndefined()
    expect(example.properties.mmsi).toEqual(["311001115"])
  })
})
