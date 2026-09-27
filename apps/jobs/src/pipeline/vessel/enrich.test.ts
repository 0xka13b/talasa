import { describe, expect, it, vi } from "vitest"
import { enrichCompanies } from "./enrich"
import type { ManagementCompany } from "./types"

function profile(over: Record<string, unknown> = {}) {
  return {
    query: "q",
    match: { value: "ACME LTD", confidence: "exact" },
    company: {
      lei: "L1", legalName: "ACME LTD", jurisdiction: "GB", registrationStatus: "ISSUED",
      entityStatus: "ACTIVE", otherNames: [], legalForm: null, category: null, registeredAs: null,
      registeredAt: null, headquartersAddress: null, bic: [],
      address: { lines: ["1 High St"], city: "London", region: null, country: "GB", postalCode: "E1" },
    },
    directParent: { lei: "P1", legalName: "ACME GROUP", jurisdiction: "GB", relationshipType: "IS_DIRECTLY_CONSOLIDATED_BY" },
    ultimateParent: null,
    ...over,
  }
}

const companies: ManagementCompany[] = [
  { companyImo: "100", role: "ism manager", roles: ["ism manager"], name: "Acme", address: null },
]

describe("enrichCompanies", () => {
  it("attaches legal info + parent for an exact match", async () => {
    const gleif = { lookupCompany: vi.fn().mockResolvedValue(profile()) }
    const res = await enrichCompanies(companies, { gleif } as never)
    expect(gleif.lookupCompany).toHaveBeenCalledWith("Acme", { includeOwnership: true })
    expect(res.companies).toHaveLength(1)
    const e = res.companies[0]!
    expect(e).toMatchObject({
      key: "100", lei: "L1", legalName: "ACME LTD", jurisdiction: "GB", registrationStatus: "ISSUED",
      address: "1 High St, London, GB",
    })
    expect(e.directParent).toEqual({ lei: "P1", legalName: "ACME GROUP", jurisdiction: "GB", nodeId: "company:parent:P1" })
    expect(e.ultimateParent).toBeNull()
  })

  it("drops fuzzy matches entirely", async () => {
    const gleif = { lookupCompany: vi.fn().mockResolvedValue(profile({ match: { value: "x", confidence: "fuzzy" } })) }
    const res = await enrichCompanies(companies, { gleif } as never)
    expect(res.companies).toHaveLength(0)
  })

  it("drops no-match (null) companies", async () => {
    const gleif = { lookupCompany: vi.fn().mockResolvedValue(null) }
    const res = await enrichCompanies(companies, { gleif } as never)
    expect(res.companies).toHaveLength(0)
  })

  it("dedupes by companyImo ?? name (one lookup per unique company)", async () => {
    const gleif = { lookupCompany: vi.fn().mockResolvedValue(profile()) }
    const dupes: ManagementCompany[] = [
      { companyImo: "100", role: "registered owner", roles: ["registered owner"], name: "Acme", address: null },
      { companyImo: "100", role: "ism manager", roles: ["ism manager"], name: "Acme", address: null },
    ]
    const res = await enrichCompanies(dupes, { gleif } as never)
    expect(gleif.lookupCompany).toHaveBeenCalledTimes(1)
    expect(res.companies).toHaveLength(1)
  })

  it("tolerates a per-company error and keeps the rest", async () => {
    const gleif = {
      lookupCompany: vi.fn()
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValueOnce(profile()),
    }
    const two: ManagementCompany[] = [
      { companyImo: "1", role: "manager", roles: ["manager"], name: "Bad", address: null },
      { companyImo: "2", role: "manager", roles: ["manager"], name: "Acme", address: null },
    ]
    const res = await enrichCompanies(two, { gleif } as never)
    expect(res.companies).toHaveLength(1)
    expect(res.companies[0]!.key).toBe("2")
  })

  it("rethrows when GLEIF is wholly unreachable (every lookup throws)", async () => {
    const gleif = { lookupCompany: vi.fn().mockRejectedValue(new Error("network")) }
    await expect(enrichCompanies(companies, { gleif } as never)).rejects.toThrow("network")
  })
})
