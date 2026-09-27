import { expect, it, vi } from "vitest"
import { resolveEntity } from "./resolve"
import type { CaseInput } from "./types"

const base: CaseInput = {
  queryName: "Hai Kuo Shipping",
  companyImo: null,
  companyAddress: null,
  role: null,
  country: "HK",
}

// CompanyResult shape: { id, name, address }
// ScreeningResult shape: { label, kind, decision, matches }

// ---------------------------------------------------------------------------
// Short path — explicit company IMO / number
// ---------------------------------------------------------------------------

it("uses the companyImo short path: searchCompaniesById, no OpenSanctions", async () => {
  const equasis = {
    searchCompaniesById: vi.fn().mockResolvedValue([
      { id: "1234567", name: "HAI KUO SHIPPING CO LTD", address: null },
    ]),
    searchCompaniesByName: vi.fn(),
  }
  const opensanctions = { screenCompany: vi.fn() }
  const inference = { choose: vi.fn() }
  const c = { equasis, opensanctions, inference } as any

  const r = await resolveEntity({ ...base, companyImo: "1234567" }, c)

  expect(equasis.searchCompaniesById).toHaveBeenCalledWith("1234567")
  expect(equasis.searchCompaniesByName).not.toHaveBeenCalled()
  expect(opensanctions.screenCompany).not.toHaveBeenCalled() // short path skips OpenSanctions
  // The Equasis company number IS the equasisCompanyId (network stage enumerates from it).
  expect(r.equasisCompanyId).toBe("1234567")
  expect(r.canonicalName.toLowerCase()).toContain("hai kuo")
  expect(r.confidence).toBe(0.85)
})

it("trusts a picked company (name + address) and skips the id lookup entirely", async () => {
  // The broker chose this company from Equasis search, so queryName is already
  // the canonical legal name and we hold its address — no need to re-query.
  const equasis = {
    searchCompaniesById: vi.fn(),
    searchCompaniesByName: vi.fn(),
  }
  const c = { equasis, opensanctions: { screenCompany: vi.fn() }, inference: { choose: vi.fn() } } as any

  const r = await resolveEntity(
    { ...base, queryName: "HAI KUO SHIPPING CO LTD", companyImo: "1234567", companyAddress: "1 Harbour Rd, Hong Kong" },
    c,
  )

  expect(equasis.searchCompaniesById).not.toHaveBeenCalled() // saved a throttled request
  expect(r.equasisCompanyId).toBe("1234567")
  expect(r.canonicalName).toBe("HAI KUO SHIPPING CO LTD")
  expect(r.address).toBe("1 Harbour Rd, Hong Kong")
  expect(r.confidence).toBe(0.9)
})

it("keeps the broker-supplied name when the company-id search fails on the short path", async () => {
  const equasis = {
    searchCompaniesById: vi.fn().mockRejectedValue(new Error("company-id search unavailable")),
    searchCompaniesByName: vi.fn(),
  }
  const c = { equasis, opensanctions: { screenCompany: vi.fn() }, inference: { choose: vi.fn() } } as any

  const r = await resolveEntity({ ...base, companyImo: "1234567" }, c)

  expect(r.equasisCompanyId).toBe("1234567")
  expect(r.canonicalName).toBe("Hai Kuo Shipping")
})

// ---------------------------------------------------------------------------
// Long path — name search
// ---------------------------------------------------------------------------

it("falls back to name search and picks the strong unambiguous candidate", async () => {
  const equasis = {
    searchCompaniesByName: vi.fn().mockResolvedValue([
      { id: "EQ1", name: "HAI KUO SHIPPING CO LTD", address: null },
    ]),
  }
  const opensanctions = {
    screenCompany: vi.fn().mockResolvedValue({
      label: "Hai Kuo Shipping",
      kind: "company" as const,
      decision: "clear" as const,
      matches: [],
    }),
  }
  const c = { equasis, opensanctions, inference: { choose: vi.fn() } } as any
  const r = await resolveEntity(base, c)
  expect(r.equasisCompanyId).toBe("EQ1")
  expect(c.opensanctions.screenCompany).toHaveBeenCalledOnce() // name path DOES screen
  expect(c.inference.choose).not.toHaveBeenCalled() // unambiguous — no LLM needed
})

it("calls inference.choose when two equally strong candidates remain", async () => {
  const equasis = {
    searchCompaniesByName: vi.fn().mockResolvedValue([
      { id: "EQ1", name: "HAI KUO SHIPPING CO LTD", address: null },
      { id: "EQ2", name: "HAI KUO SHIPPING PTE LTD", address: null },
    ]),
  }
  const opensanctions = {
    screenCompany: vi.fn().mockResolvedValue({
      label: "Hai Kuo Shipping",
      kind: "company" as const,
      decision: "clear" as const,
      matches: [],
    }),
  }
  const inference = { choose: vi.fn().mockResolvedValue("HAI KUO SHIPPING CO LTD") }
  const c = { equasis, opensanctions, inference } as any
  const r = await resolveEntity(base, c)
  expect(c.inference.choose).toHaveBeenCalled()
  expect(r.canonicalName).toBe("HAI KUO SHIPPING CO LTD")
})
