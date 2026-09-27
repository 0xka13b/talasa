import { describe, it, expect } from "vitest"
import { parseBatchGrid, normalizeImo, cleanVesselName, findImoColumn, findNameColumn } from "./batch.js"

describe("normalizeImo", () => {
  it("accepts a bare 7-digit IMO", () => {
    expect(normalizeImo("9304162")).toBe("9304162")
  })
  it("tolerates an IMO prefix, spaces and dashes", () => {
    expect(normalizeImo(" IMO 9304162 ")).toBe("9304162")
    expect(normalizeImo("IMO: 9304162")).toBe("9304162")
  })
  it("strips an Excel numeric .0 tail", () => {
    expect(normalizeImo("9304162.0")).toBe("9304162")
  })
  it("rejects non-7-digit values (MMSI, short, empty)", () => {
    expect(normalizeImo("123456789")).toBeNull()
    expect(normalizeImo("12345")).toBeNull()
    expect(normalizeImo("")).toBeNull()
    expect(normalizeImo(null)).toBeNull()
  })
})

describe("cleanVesselName", () => {
  it("strips a trailing (dd/mm/yy) survey-date parenthetical", () => {
    expect(cleanVesselName("MONTKAJ(09/03/26)")).toBe("MONTKAJ")
    expect(cleanVesselName("AL FAHEDI(07/05/26)")).toBe("AL FAHEDI")
  })
  it("returns empty for a blank cell", () => {
    expect(cleanVesselName("")).toBe("")
    expect(cleanVesselName(null)).toBe("")
  })
})

describe("column detection", () => {
  it("matches IMO across header variants", () => {
    expect(findImoColumn(["IMO", "SHIP NAME"])).toBe(0)
    expect(findImoColumn(["Ship Name", "Vessel IMO"])).toBe(1)
    expect(findImoColumn(["Ship IMO", "Name"])).toBe(0)
    expect(findImoColumn(["No.", "IMO Number", "Flag"])).toBe(1)
    expect(findImoColumn(["Foo", "Bar"])).toBe(-1)
  })
  it("prefers ship/vessel name over a bare name column", () => {
    expect(findNameColumn(["IMO", "Owner Name", "Ship Name"], 0)).toBe(2)
    expect(findNameColumn(["IMO", "Name"], 0)).toBe(1)
  })
})

describe("parseBatchGrid — real registry export shape", () => {
  // Mirrors ~/Desktop/batch_example.csv: semicolon export (already split into
  // cells by the reader), duplicate IMOs, name(date) format, and blank names.
  const grid = [
    ["IMO", "SHIP NAME", "CLASS", "STATUS"],
    ["1000021", "MONTKAJ(09/03/26)", "LRS", "Delivered"],
    ["1000021", "MONTKAJ(07/05/26)", "LRS", "Delivered"], // duplicate IMO
    ["1000033", "ASTRALIUM(22/04/25)", "LRS", "Delivered"],
    ["1000150", "", "LRS", "Delivered"], // blank name
    ["not-an-imo", "GHOST", "LRS", "Delivered"], // invalid
  ]

  it("extracts deduped IMO+name, defaulting blank names to IMO <n> and flagging them", () => {
    const out = parseBatchGrid(grid)
    expect(out.vessels).toEqual([
      { imo: "1000021", name: "MONTKAJ", nameMissing: false },
      { imo: "1000033", name: "ASTRALIUM", nameMissing: false },
      { imo: "1000150", name: "IMO 1000150", nameMissing: true },
    ])
    expect(out.imoHeader).toBe("IMO")
    expect(out.nameHeader).toBe("SHIP NAME")
    expect(out.duplicateCount).toBe(1)
    expect(out.invalidCount).toBe(1)
    expect(out.nameMissingCount).toBe(1)
    expect(out.scannedRows).toBe(5)
    expect(out.error).toBeNull()
  })

  it("reports invalid rows with their source line number so the user can find them", () => {
    const out = parseBatchGrid(grid)
    // "not-an-imo" sits on grid index 5 → file line 6.
    expect(out.invalidSamples).toEqual([
      { line: 6, rawImo: "not-an-imo", rawName: "GHOST", reason: "Not a valid 7-digit IMO" },
    ])
  })

  it("works when the IMO column is not first and named 'Vessel IMO'", () => {
    const out = parseBatchGrid([
      ["Vessel Name", "Vessel IMO"],
      ["North Star", "9304162"],
    ])
    expect(out.vessels).toEqual([{ imo: "9304162", name: "North Star", nameMissing: false }])
  })

  it("falls back to content detection when there is no header row", () => {
    const out = parseBatchGrid([
      ["9304162", "NORTH STAR"],
      ["9298492", "SUBJECT"],
    ])
    expect(out.imoHeader).toBeNull()
    expect(out.imoColumnFound).toBe(true)
    expect(out.vessels).toEqual([
      { imo: "9304162", name: "NORTH STAR", nameMissing: false },
      { imo: "9298492", name: "SUBJECT", nameMissing: false },
    ])
  })

  it("explains an empty file", () => {
    const out = parseBatchGrid([])
    expect(out.vessels).toEqual([])
    expect(out.error).toMatch(/empty/i)
  })

  it("explains a file with no IMO column", () => {
    const out = parseBatchGrid([
      ["Port", "Flag", "Owner"],
      ["Novorossiysk", "Panama", "Acme"],
    ])
    expect(out.imoColumnFound).toBe(false)
    expect(out.error).toMatch(/No IMO column/i)
  })

  it("explains a file whose IMO column has no valid IMOs", () => {
    const out = parseBatchGrid([
      ["IMO", "Name"],
      ["12345", "Too short"],
      ["ABCDEFG", "Letters"],
    ])
    expect(out.imoColumnFound).toBe(true)
    expect(out.vessels).toEqual([])
    expect(out.error).toMatch(/No valid IMOs/i)
  })
})
