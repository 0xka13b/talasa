import { describe, expect, it } from "vitest"
import { artListParams, entityQuery } from "../src/endpoints"
import { GdeltConfigError } from "../src/errors"

describe("entityQuery", () => {
  it("quotes a multi-word name as an exact phrase", () => {
    expect(entityQuery("HAI KUO SHIPPING 1984B LTD")).toBe('"HAI KUO SHIPPING 1984B LTD"')
  })

  it("appends adverse-tone, language and country filters", () => {
    const q = entityQuery("Sovcomflot", { maxTone: -5, sourceLang: "english", sourceCountry: "russia" })
    expect(q).toBe('"Sovcomflot" tone<-5 sourcelang:english sourcecountry:russia')
  })

  it("escapes embedded quotes", () => {
    expect(entityQuery('AB "NOVA" LTD')).toBe('"AB \\"NOVA\\" LTD"')
  })

  it("rejects an empty name", () => {
    expect(() => entityQuery("   ")).toThrow(GdeltConfigError)
  })
})

describe("artListParams", () => {
  it("sets the fixed DOC parameters and maps the sort name", () => {
    const p = artListParams({ query: '"ACME"', sort: "toneAsc", maxRecords: 10, timespan: "1w" })
    expect(p.get("mode")).toBe("ArtList")
    expect(p.get("format")).toBe("json")
    expect(p.get("sort")).toBe("ToneAsc")
    expect(p.get("maxrecords")).toBe("10")
    expect(p.get("timespan")).toBe("1w")
  })

  it("clamps maxrecords to the 250 ceiling and the 1 floor", () => {
    expect(artListParams({ query: "x", maxRecords: 9999 }).get("maxrecords")).toBe("250")
    expect(artListParams({ query: "x", maxRecords: 0 }).get("maxrecords")).toBe("1")
  })

  it("prefers an explicit date window over timespan and stamps Dates", () => {
    const p = artListParams({
      query: "x",
      timespan: "1w",
      startDate: new Date("2026-06-01T12:00:00Z"),
      endDate: "20260615000000",
    })
    expect(p.get("startdatetime")).toBe("20260601120000")
    expect(p.get("enddatetime")).toBe("20260615000000")
    expect(p.has("timespan")).toBe(false)
  })

  it("rejects an empty query", () => {
    expect(() => artListParams({ query: "  " })).toThrow(GdeltConfigError)
  })
})
