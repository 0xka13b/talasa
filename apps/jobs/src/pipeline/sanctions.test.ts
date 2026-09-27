import { expect, it, vi } from "vitest"
import { screenSanctions, type SanctionsInput } from "./sanctions"
import { subjectNodeId, companyNodeId, vesselNodeId } from "./graph"
import type { LinkedCompany } from "@talasa/shared"

// screenSanctions(input, c) where
//   input = { subjectName, equasisId, country, linkedCompanies, ownership, fleetImos }
// Calls opensanctions.screenCounterparty({ companies }) ONCE, then
// screenCounterparty({ vessel: { imo } }) per capped fleet IMO.

const baseInput: SanctionsInput = {
  subjectName: "Acme Shipping Co",
  equasisId: "EQ1",
  country: "SG",
  linkedCompanies: [],
  ownership: null,
  fleetImos: [],
}

// ScreeningMatch shape (see @talasa/opensanctions).
const makeMatch = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "M1",
  caption: "Acme Shipping Co",
  schema: "Company",
  score: 0.9,
  isMatch: true,
  target: true,
  sanctioned: true,
  topics: ["sanction"],
  datasets: ["us_ofac_sdn"],
  notes: [],
  description: null,
  firstSeen: null,
  lastSeen: null,
  lastChange: null,
  category: "sanctioned",
  ...over,
})

// A screenCounterparty mock that branches on the shape of its single argument:
// { companies } → company results; { vessel } → vessel results for that IMO.
function makeOpenSanctions(opts: {
  companyResults?: any[]
  vesselResults?: (imo: string) => any[]
}) {
  return {
    screenCounterparty: vi.fn().mockImplementation((arg: any) => {
      if (arg.companies) return Promise.resolve({ overall: "clear", results: opts.companyResults ?? [] })
      if (arg.vessel) return Promise.resolve({ overall: "clear", results: opts.vesselResults?.(arg.vessel.imo) ?? [] })
      return Promise.resolve({ overall: "clear", results: [] })
    }),
  }
}

it("returns NO_MATCH when every target is clear with no matches", async () => {
  const opensanctions = makeOpenSanctions({
    companyResults: [{ label: subjectNodeId("EQ1", "Acme Shipping Co"), kind: "company", decision: "clear", matches: [] }],
  })
  const result = await screenSanctions(baseInput, { opensanctions } as any)

  expect(result.status).toBe("NO_MATCH")
  expect(result.matches).toEqual([])
  expect(result.nodeCategories).toEqual({})
})

it("screens all companies in ONE batched screenCounterparty call, labelled with graph node ids", async () => {
  const linkedCompanies: LinkedCompany[] = [
    { companyImo: "EQ2", name: "Beta Mgmt", roles: ["ISM Manager"], sharedVesselImos: ["9000001"], sanctioned: false, fleetCount: 0, fleet: [] },
  ]
  const opensanctions = makeOpenSanctions({ companyResults: [] })
  await screenSanctions({ ...baseInput, linkedCompanies }, { opensanctions } as any)

  // Exactly one call because there are no fleet IMOs to screen.
  expect(opensanctions.screenCounterparty).toHaveBeenCalledOnce()
  const arg = (opensanctions.screenCounterparty.mock.calls[0] as unknown[])[0] as { companies: any[] }
  const bySubject = arg.companies.find((c) => c.label === subjectNodeId("EQ1", "Acme Shipping Co"))
  const byLinked = arg.companies.find((c) => c.label === companyNodeId("EQ2", "Beta Mgmt"))
  expect(bySubject?.name).toBe("Acme Shipping Co")
  expect(byLinked?.name).toBe("Beta Mgmt")
})

it("returns POSSIBLE for a name-only company review and colours the subject node", async () => {
  const opensanctions = makeOpenSanctions({
    companyResults: [
      {
        label: subjectNodeId("EQ1", "Acme Shipping Co"),
        kind: "company",
        decision: "review",
        matches: [makeMatch({ id: "REV-1", caption: "Acme Shipping Co", score: 0.75 })],
      },
    ],
  })
  const result = await screenSanctions(baseInput, { opensanctions } as any)

  expect(result.status).toBe("POSSIBLE")
  expect(result.matches).toHaveLength(1)
  expect(result.matches[0]).toMatchObject({ entity: "Acme Shipping Co", tier: 3, list: "us_ofac_sdn", score: 0.75 })
  // The subject node is coloured with the worst category.
  expect(result.nodeCategories[subjectNodeId("EQ1", "Acme Shipping Co")]).toEqual({ sanctioned: true, category: "sanctioned" })
})

it("returns CONFIRMED for a fleet-IMO hit with a sanctioned category and colours the vessel node", async () => {
  const opensanctions = makeOpenSanctions({
    companyResults: [{ label: subjectNodeId("EQ1", "Acme Shipping Co"), kind: "company", decision: "clear", matches: [] }],
    vesselResults: (imo) => [
      {
        label: `raw:${imo}`, // deliberately not the node id — the stage relabels vessel results.
        kind: "vessel",
        decision: "hit",
        matches: [makeMatch({ id: "VES-1", caption: "MV Acme Star", schema: "Vessel", score: 0.97, datasets: ["eu_fsf"] })],
      },
    ],
  })
  const result = await screenSanctions({ ...baseInput, fleetImos: ["9000001"] }, { opensanctions } as any)

  expect(result.status).toBe("CONFIRMED")
  expect(result.matches).toHaveLength(1)
  expect(result.matches[0]).toMatchObject({ tier: 1, score: 0.97, list: "eu_fsf" })
  // Vessel result is relabelled with the vessel node id, then coloured.
  expect(result.nodeCategories[vesselNodeId("9000001")]).toEqual({ sanctioned: true, category: "sanctioned" })
  // Company + one vessel IMO = two screenCounterparty calls.
  expect(opensanctions.screenCounterparty).toHaveBeenCalledTimes(2)
})

it("downgrades a sanction-LINKED identifier hit to POSSIBLE (not CONFIRMED)", async () => {
  const opensanctions = makeOpenSanctions({
    companyResults: [],
    vesselResults: (imo) => [
      {
        label: `raw:${imo}`,
        kind: "vessel",
        decision: "hit",
        matches: [makeMatch({ id: "LINK-1", caption: "Linked Vessel", schema: "Vessel", target: false, topics: ["sanction.linked"], category: "sanction_linked", datasets: ["ext_graph"] })],
      },
    ],
  })
  const result = await screenSanctions({ ...baseInput, fleetImos: ["9000001"] }, { opensanctions } as any)

  // Linked, not directly designated → POSSIBLE, so no auto-REJECT downstream.
  expect(result.status).toBe("POSSIBLE")
  expect(result.nodeCategories[vesselNodeId("9000001")]).toEqual({ sanctioned: false, category: "sanction_linked" })
})

it("deduplicates matches with the same entity id across results", async () => {
  const shared = makeMatch({ id: "DUP-1", caption: "Duplicated Entity" })
  const linkedCompanies: LinkedCompany[] = [
    { companyImo: "EQ2", name: "Beta Mgmt", roles: ["ISM Manager"], sharedVesselImos: ["9000001"], sanctioned: false, fleetCount: 0, fleet: [] },
  ]
  const opensanctions = makeOpenSanctions({
    companyResults: [
      { label: subjectNodeId("EQ1", "Acme Shipping Co"), kind: "company", decision: "review", matches: [shared] },
      { label: companyNodeId("EQ2", "Beta Mgmt"), kind: "company", decision: "review", matches: [shared] },
    ],
  })
  const result = await screenSanctions({ ...baseInput, linkedCompanies }, { opensanctions } as any)

  const withId = result.matches.filter((m) => m.entity === "Duplicated Entity")
  expect(withId).toHaveLength(1)
})
