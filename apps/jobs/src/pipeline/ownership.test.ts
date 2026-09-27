import { expect, it, vi } from "vitest"
import { resolveOwnership } from "./ownership"

// GleifClient.lookupCompany(name, { includeOwnership }) → GleifCompanyProfile | null
// GleifCompanyProfile: { query, match: { value, confidence }, company: GleifCompany,
//                        directParent: GleifOwnershipLink | null, ultimateParent: … | null }

const makeProfile = (over: Partial<Record<string, unknown>> = {}) => ({
  query: "Acme Shipping Co",
  match: { value: "ACME SHIPPING CO", confidence: "exact" as const },
  company: {
    lei: "5493001KJTIIGC8Y1R12",
    legalName: "ACME SHIPPING CO",
    otherNames: [],
    jurisdiction: "SG",
    entityStatus: "ACTIVE",
    registrationStatus: "ISSUED",
    legalForm: null,
    category: null,
    registeredAs: null,
    registeredAt: null,
    address: null,
    headquartersAddress: null,
    bic: [],
  },
  directParent: {
    lei: "PARENT-DIRECT",
    legalName: "Acme Holdings",
    jurisdiction: "SG",
    relationshipType: "IS_DIRECTLY_CONSOLIDATED_BY",
  },
  ultimateParent: {
    lei: "PARENT-ULTIMATE",
    legalName: "Acme Global",
    jurisdiction: "KY",
    relationshipType: "IS_ULTIMATELY_CONSOLIDATED_BY",
  },
  ...over,
})

it("maps a GleifCompanyProfile onto CompanyOwnership", async () => {
  const gleif = { lookupCompany: vi.fn().mockResolvedValue(makeProfile()) }
  const result = await resolveOwnership("Acme Shipping Co", { gleif } as any)

  expect(gleif.lookupCompany).toHaveBeenCalledWith("Acme Shipping Co", { includeOwnership: true })
  expect(result).toEqual({
    lei: "5493001KJTIIGC8Y1R12",
    legalName: "ACME SHIPPING CO",
    jurisdiction: "SG",
    registrationStatus: "ISSUED",
    matchConfidence: "exact",
    directParent: { lei: "PARENT-DIRECT", legalName: "Acme Holdings", jurisdiction: "SG" },
    ultimateParent: { lei: "PARENT-ULTIMATE", legalName: "Acme Global", jurisdiction: "KY" },
  })
})

it("returns null parents when GLEIF found no consolidating parents", async () => {
  const gleif = { lookupCompany: vi.fn().mockResolvedValue(makeProfile({ directParent: null, ultimateParent: null })) }
  const result = await resolveOwnership("Acme Shipping Co", { gleif } as any)

  expect(result?.directParent).toBeNull()
  expect(result?.ultimateParent).toBeNull()
  expect(result?.matchConfidence).toBe("exact")
})

it("carries a fuzzy match confidence through", async () => {
  const gleif = {
    lookupCompany: vi.fn().mockResolvedValue(makeProfile({ match: { value: "ACME SHIPPING CO", confidence: "fuzzy" } })),
  }
  const result = await resolveOwnership("Acme Shipping Co", { gleif } as any)
  expect(result?.matchConfidence).toBe("fuzzy")
})

it("returns null when the name can't be matched to an LEI record", async () => {
  const gleif = { lookupCompany: vi.fn().mockResolvedValue(null) }
  const result = await resolveOwnership("Unknown Co", { gleif } as any)
  expect(result).toBeNull()
})
