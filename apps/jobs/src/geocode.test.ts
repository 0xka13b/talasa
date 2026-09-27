import { describe, it, expect } from "vitest"
import { pickPlaceLabel } from "./geocode"

function comp(long_name: string, ...types: string[]) {
  return { long_name, short_name: long_name, types }
}

describe("pickPlaceLabel", () => {
  it("combines locality and country", () => {
    const res = {
      status: "OK",
      results: [
        {
          formatted_address: "Freetown, Sierra Leone",
          address_components: [comp("Freetown", "locality"), comp("Sierra Leone", "country")],
        },
      ],
    }
    expect(pickPlaceLabel(res)).toBe("Freetown, Sierra Leone")
  })

  it("falls back to admin area when no locality", () => {
    const res = {
      status: "OK",
      results: [
        {
          formatted_address: "Banjul Division, The Gambia",
          address_components: [comp("Banjul", "administrative_area_level_1"), comp("The Gambia", "country")],
        },
      ],
    }
    expect(pickPlaceLabel(res)).toBe("Banjul, The Gambia")
  })

  it("returns just the country when that's all there is", () => {
    const res = {
      status: "OK",
      results: [{ formatted_address: "Nigeria", address_components: [comp("Nigeria", "country")] }],
    }
    expect(pickPlaceLabel(res)).toBe("Nigeria")
  })

  it("returns a natural feature with no country (open water)", () => {
    const res = {
      status: "OK",
      results: [
        { formatted_address: "North Atlantic Ocean", address_components: [comp("North Atlantic Ocean", "natural_feature", "establishment")] },
      ],
    }
    expect(pickPlaceLabel(res)).toBe("North Atlantic Ocean")
  })

  it("does not duplicate when locality equals country", () => {
    const res = {
      status: "OK",
      results: [{ formatted_address: "Singapore", address_components: [comp("Singapore", "locality"), comp("Singapore", "country")] }],
    }
    expect(pickPlaceLabel(res)).toBe("Singapore")
  })

  it("returns null for ZERO_RESULTS (mid-ocean)", () => {
    expect(pickPlaceLabel({ status: "ZERO_RESULTS", results: [] })).toBeNull()
  })

  it("returns null for an error status", () => {
    expect(pickPlaceLabel({ status: "REQUEST_DENIED", results: [] })).toBeNull()
  })
})
