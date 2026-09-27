import { expect, it, vi } from "vitest"
import { mapCompanyNetwork } from "./network"
import type { ResolvedEntity } from "@talasa/shared"

// Equasis network crawl:
//  getCompanyFleet(equasisId) → { companyImo, name, vessels: [{ imo, name, flag, type }] }
//  getShipByImo(imo)          → ShipInfo (only `management` is read here)
//  getShipInspections(imo)    → { imo, inspections: [{ authority, date, port, detained, deficiencies }] }
// A management entry whose companyImo === equasisId is the SUBJECT's own entry;
// every OTHER company on a shared vessel becomes a linked company.

const resolved: ResolvedEntity = {
  canonicalName: "Acme Shipping Co",
  aliases: [],
  country: "SG",
  address: null,
  equasisCompanyId: "EQ1",
  fleetImos: [],
  sanctionsEntityId: null,
  confidence: 0.9,
}

const subjectEntry = {
  companyImo: "EQ1",
  role: "ISM Manager",
  name: "ACME SHIPPING CO LTD",
  address: "1 Marina Blvd, Singapore",
  dateOfEffect: null,
}
const linkedEntry = {
  companyImo: "EQ2",
  role: "Registered Owner",
  name: "Beta Owner Ltd",
  address: "5 Marina Way, Singapore",
  dateOfEffect: null,
}

const managementByImo: Record<string, unknown[]> = {
  "9000001": [subjectEntry, linkedEntry],
  "9000002": [subjectEntry, linkedEntry],
}

const inspectionsByImo: Record<string, unknown[]> = {
  "9000001": [{ authority: "Paris MoU", date: "01/02/2026", port: "Rotterdam", detained: true, deficiencies: 3 }],
  "9000002": [{ authority: "Tokyo MoU", date: "05/03/2026", port: "Busan", detained: false, deficiencies: 0 }],
}

function makeEquasis() {
  return {
    // Name search: used only as a fallback when resolve left equasisCompanyId null.
    searchCompaniesByName: vi.fn().mockResolvedValue([]),
    // Arg-aware: the subject (EQ1) returns its fleet; the affiliate (EQ2) returns
    // its OWN fleet via the second-level crawl.
    getCompanyFleet: vi.fn().mockImplementation((companyImo: string) =>
      Promise.resolve(
        companyImo === "EQ2"
          ? {
              companyImo: "EQ2",
              name: "Beta Owner Ltd",
              vessels: [
                { imo: "9500001", name: "MV Beta One", flag: "LR", type: "Tanker" },
                { imo: "9500002", name: "MV Beta Two", flag: "LR", type: "Crude Oil Tanker" },
              ],
            }
          : {
              companyImo: "EQ1",
              name: "Acme Shipping Co",
              vessels: [
                { imo: "9000001", name: "MV Acme Star", flag: "SG", type: "Bulk Carrier" },
                { imo: "9000002", name: "MV Acme Moon", flag: "PA", type: "Tanker" },
              ],
            },
      ),
    ),
    getShipByImo: vi.fn().mockImplementation((imo: string) => Promise.resolve({ management: managementByImo[imo] ?? [] })),
    getShipInspections: vi.fn().mockImplementation((imo: string) => Promise.resolve({ imo, inspections: inspectionsByImo[imo] ?? [] })),
  }
}

it("enumerates the fleet and captures the subject's own company profile", async () => {
  const equasis = makeEquasis()
  const result = await mapCompanyNetwork(resolved, { equasis } as any)

  expect(equasis.getCompanyFleet).toHaveBeenCalledWith("EQ1")
  expect(result.fleet).toHaveLength(2)
  expect(result.fleet.map((v) => v.imo)).toEqual(["9000001", "9000002"])
  // Subject profile is refined from its own management entry.
  expect(result.companyProfile.equasisId).toBe("EQ1")
  expect(result.companyProfile.name).toBe("ACME SHIPPING CO LTD")
  expect(result.companyProfile.address).toBe("1 Marina Blvd, Singapore")
  expect(result.companyProfile.fleetCount).toBe(2)
  expect(result.truncated).toBe(false)
})

it("extracts linked companies from shared management chains", async () => {
  const equasis = makeEquasis()
  const result = await mapCompanyNetwork(resolved, { equasis } as any)

  // The subject (EQ1) is NOT a linked company; Beta Owner (EQ2) is, shared across both vessels.
  expect(result.linkedCompanies).toHaveLength(1)
  const beta = result.linkedCompanies[0]!
  expect(beta.companyImo).toBe("EQ2")
  expect(beta.name).toBe("Beta Owner Ltd")
  expect(beta.roles).toContain("Registered Owner")
  expect(beta.sharedVesselImos).toEqual(["9000001", "9000002"])
  expect(beta.sanctioned).toBe(false)
  // The affiliate's address is captured from its management entry.
  expect(beta.address).toBe("5 Marina Way, Singapore")

  // Per-vessel owner/manager derived from the chain.
  expect(result.owners).toContain("Beta Owner Ltd")
  expect(result.managers).toContain("ACME SHIPPING CO LTD")
})

it("enriches the closest affiliates with their OWN fleet (second-level crawl)", async () => {
  const equasis = makeEquasis()
  const result = await mapCompanyNetwork(resolved, { equasis } as any)

  // Beta Owner (EQ2) is an affiliate; the stage enumerated its own fleet by id.
  expect(equasis.getCompanyFleet).toHaveBeenCalledWith("EQ2")
  const beta = result.linkedCompanies.find((c) => c.companyImo === "EQ2")!
  expect(beta.fleetCount).toBe(2)
  expect(beta.fleet.map((v) => v.imo)).toEqual(["9500001", "9500002"])
  // Listing-only: affiliate vessels carry no owner/manager (ship page not opened).
  expect(beta.fleet[0]!.registeredOwner).toBeNull()
})

it("does not misattribute the subject as its own linked company", async () => {
  // On one vessel the subject also appears WITHOUT a company number (Equasis
  // didn't hyperlink it) under its full name — it must not leak into linkedCompanies.
  const equasis = makeEquasis()
  const subjectAliasRow = { companyImo: null, role: "Manager", name: "ACME SHIPPING CO LTD", address: null, dateOfEffect: null }
  equasis.getShipByImo.mockImplementation((imo: string) =>
    Promise.resolve({
      management: imo === "9000001" ? [subjectEntry, subjectAliasRow, linkedEntry] : [subjectEntry, linkedEntry],
    }),
  )
  const result = await mapCompanyNetwork(resolved, { equasis } as any)

  expect(result.linkedCompanies.map((c) => c.name)).toEqual(["Beta Owner Ltd"])
  expect(result.linkedCompanies.some((c) => c.name === "ACME SHIPPING CO LTD")).toBe(false)
})

it("collects detentions from PSC inspections (only detained ones)", async () => {
  const equasis = makeEquasis()
  const result = await mapCompanyNetwork(resolved, { equasis } as any)

  expect(result.detentions).toHaveLength(1)
  const d = result.detentions[0]!
  expect(d.imo).toBe("9000001")
  expect(d.authority).toBe("Paris MoU")
  expect(d.detail).toContain("Rotterdam")
  expect(d.detail).toContain("3 deficiencies")
})

it("re-resolves the company id by name search when resolve left it null", async () => {
  // Resolve produced no Equasis id (transient failure / OpenSanctions-only match);
  // the network stage searches by name itself so the fleet isn't blanked.
  const equasis = makeEquasis()
  equasis.searchCompaniesByName.mockResolvedValue([{ id: "EQ1", name: "Acme Shipping Co", address: "Somewhere" }])
  const result = await mapCompanyNetwork({ ...resolved, equasisCompanyId: null }, { equasis } as any)

  expect(equasis.searchCompaniesByName).toHaveBeenCalledWith("Acme Shipping Co")
  expect(equasis.getCompanyFleet).toHaveBeenCalledWith("EQ1")
  expect(result.fleet).toHaveLength(2)
})

it("returns an empty network when the company can't be resolved at all", async () => {
  const equasis = makeEquasis() // searchCompaniesByName defaults to []
  const result = await mapCompanyNetwork({ ...resolved, equasisCompanyId: null }, { equasis } as any)

  expect(equasis.searchCompaniesByName).toHaveBeenCalled()
  expect(equasis.getCompanyFleet).not.toHaveBeenCalled()
  expect(result.fleet).toEqual([])
  expect(result.linkedCompanies).toEqual([])
  expect(result.detentions).toEqual([])
  expect(result.companyProfile.equasisId).toBeNull()
  expect(result.companyProfile.name).toBe("Acme Shipping Co")
  expect(result.truncated).toBe(false)
})

it("drops a vessel's detail without failing when its ship page errors", async () => {
  const equasis = makeEquasis()
  equasis.getShipByImo.mockImplementation((imo: string) =>
    imo === "9000002" ? Promise.reject(new Error("ship page unavailable")) : Promise.resolve({ management: managementByImo[imo] ?? [] }),
  )
  const result = await mapCompanyNetwork(resolved, { equasis } as any)

  // Fleet listing still has both; the failed vessel just lacks owner/manager detail.
  expect(result.fleet).toHaveLength(2)
  const failed = result.fleet.find((v) => v.imo === "9000002")!
  expect(failed.registeredOwner).toBeNull()
  // Beta Owner now only shared via the vessel that loaded.
  expect(result.linkedCompanies[0]!.sharedVesselImos).toEqual(["9000001"])
})
