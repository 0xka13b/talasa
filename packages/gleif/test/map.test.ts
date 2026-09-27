import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  mapFuzzyMatches,
  mapLeiRecord,
  matchConfidence,
  normalizeName,
  toOwnershipLink,
} from "../src/map"
import { fuzzyResponseSchema, leiRecordResponseSchema } from "../src/types"

const here = dirname(fileURLToPath(import.meta.url))
const load = (name: string) => JSON.parse(readFileSync(join(here, "fixtures", name), "utf8"))

describe("mapLeiRecord", () => {
  it("trims a raw record to the domain shape", () => {
    const rec = leiRecordResponseSchema.parse(load("lei-record.json")).data
    const company = mapLeiRecord(rec)
    expect(company).toEqual({
      lei: "529900W18LQJJN6SJ336",
      legalName: "Société Générale Effekten GmbH",
      otherNames: [],
      jurisdiction: "DE",
      entityStatus: "ACTIVE",
      registrationStatus: "ISSUED",
      legalForm: "2HBR",
      category: null,
      registeredAs: "HRB 32283",
      registeredAt: "RA000242",
      address: {
        lines: ["Neue Mainzer Straße 46-50"],
        city: "Frankfurt am Main",
        region: "DE-HE",
        country: "DE",
        postalCode: "60311",
      },
      headquartersAddress: {
        lines: ["Neue Mainzer Straße 46-50"],
        city: "Frankfurt am Main",
        region: "DE-HE",
        country: "DE",
        postalCode: "60311",
      },
      bic: ["SGEFDEFFXXX", "SGEGDEF1XXX"],
    })
  })

  it("uses legalForm.other when id is a generic code, and null bic -> []", () => {
    const rec = leiRecordResponseSchema.parse(load("direct-parent.json")).data
    const company = mapLeiRecord(rec)
    expect(company.legalForm).toBe("8888")
    expect(company.bic).toEqual([])
    expect(company.headquartersAddress).toBeNull()
  })
})

describe("mapFuzzyMatches", () => {
  it("extracts {lei, value} and drops entries without a lei", () => {
    const raw = fuzzyResponseSchema.parse(load("fuzzycompletions.json")).data
    const matches = mapFuzzyMatches(raw)
    expect(matches[0]).toEqual({ lei: "529900W18LQJJN6SJ336", value: "Société Générale Effekten GmbH" })
    expect(matches).toHaveLength(2)
  })
})

describe("toOwnershipLink", () => {
  it("builds an ownership link from a company + relationship type", () => {
    const rec = leiRecordResponseSchema.parse(load("direct-parent.json")).data
    const link = toOwnershipLink(mapLeiRecord(rec), "IS_DIRECTLY_CONSOLIDATED_BY")
    expect(link).toEqual({
      lei: "O2RNE8IBXP4R0TD8PU41",
      legalName: "SOCIETE GENERALE",
      jurisdiction: "FR",
      relationshipType: "IS_DIRECTLY_CONSOLIDATED_BY",
    })
  })
})

describe("matchConfidence / normalizeName", () => {
  it("normalizes case, punctuation and whitespace", () => {
    expect(normalizeName("Société  Générale, Effekten GmbH.")).toBe(
      normalizeName("societe générale effekten gmbh"),
    )
  })
  it("equal normalized names -> exact, else fuzzy", () => {
    expect(matchConfidence("ACME SHIPPING LTD", "Acme Shipping Ltd")).toBe("exact")
    expect(matchConfidence("ACME SHIPPING", "Acme Shipping Holdings")).toBe("fuzzy")
  })
})
