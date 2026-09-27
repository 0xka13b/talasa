import { describe, it, expect } from "vitest"
import type { VesselBrief } from "./vessel.js"
import { buildWatchSnapshot, hashSnapshot, diffSnapshots, shouldNotify, type WatchSnapshot } from "./watch-snapshot.js"
import { facetsForChecks, stagesForChecks } from "./monitor.js"

// Minimal brief factory — buildWatchSnapshot only reads a handful of fields, so
// we construct just those and cast (tests don't round-trip through zod).
function brief(over: Partial<VesselBrief> = {}): VesselBrief {
  return {
    identity: { flag: "PA" },
    companies: [],
    fleet: { sisters: [] },
    sanctions: { matches: [] },
    inferredOwnership: null,
    ais: null,
    inspections: null,
    verdict: { decision: "PROCEED", score: 10, drivers: [], justification: "" },
    ...over,
  } as unknown as VesselBrief
}

const sanction = (entity: string, over: Record<string, unknown> = {}) => ({
  entity, list: "OFAC SDN", matchField: "name", score: 1, tier: "hit", nodeId: `n:${entity}`, category: "sanctioned", ...over,
})

describe("buildWatchSnapshot", () => {
  it("projects and sorts sanctions by stable key", () => {
    const snap = buildWatchSnapshot(brief({ sanctions: { status: "CONFIRMED", subjectHit: true, companyHits: [], sisterHits: [], matches: [sanction("Zeta"), sanction("Alpha")], narrative: "" } as any }))
    expect(snap.sanctions.map((s) => s.entity)).toEqual(["Alpha", "Zeta"])
    expect(snap.sanctions[0]).toMatchObject({ key: "n:Alpha", list: "OFAC SDN", category: "sanctioned", tier: "hit" })
  })

  it("derives fleet direct/linked counts from sister categories", () => {
    const snap = buildWatchSnapshot(brief({ fleet: { sisters: [
      { imo: "1", sanctioned: true, category: "sanctioned" },
      { imo: "2", sanctioned: false, category: "sanction_linked" },
      { imo: "3", sanctioned: false, category: "other" },
    ], companies: [], truncated: false, note: null } as any }))
    expect(snap.fleetHits).toEqual({ direct: 1, linked: 1 })
  })

  it("treats a non-'other' company category as sanctioned in the ownership facet", () => {
    const snap = buildWatchSnapshot(brief({ companies: [
      { companyImo: "5000001", role: "Registered owner", roles: [], name: "Acme", address: null, sanctioned: false, category: "sanction_linked", parentSanctioned: false },
    ] as any }))
    expect(snap.ownership[0]).toMatchObject({ key: "imo:5000001", role: "Registered owner", sanctioned: true })
  })
})

describe("hashSnapshot", () => {
  const base = buildWatchSnapshot(brief({ sanctions: { matches: [sanction("Alpha")] } as any }))

  it("is deterministic and key-order independent", () => {
    expect(hashSnapshot(base).overall).toBe(hashSnapshot(base).overall)
    const reordered: WatchSnapshot = { ...base }
    expect(hashSnapshot(reordered).overall).toBe(hashSnapshot(base).overall)
  })

  it("only the touched facet's fingerprint moves", () => {
    const changed = buildWatchSnapshot(brief({ sanctions: { matches: [sanction("Beta")] } as any }))
    const a = hashSnapshot(base).byFacet
    const b = hashSnapshot(changed).byFacet
    expect(b.sanctions).not.toBe(a.sanctions)
    expect(b.flag).toBe(a.flag)
    expect(b.inspections).toBe(a.inspections)
  })
})

describe("diffSnapshots", () => {
  it("identical snapshots produce no changes (a carried-forward facet never false-fires)", () => {
    const s = buildWatchSnapshot(brief({ sanctions: { matches: [sanction("Alpha")] } as any }))
    expect(diffSnapshots(s, s)).toEqual([])
  })

  it("reports an added sanction as an escalation", () => {
    const prev = buildWatchSnapshot(brief())
    const next = buildWatchSnapshot(brief({ sanctions: { matches: [sanction("New Co")] } as any }))
    const changes = diffSnapshots(prev, next, ["sanctions"])
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ facet: "sanctions", kind: "added", escalation: true })
    expect(changes[0]!.label).toContain("New Co")
  })

  it("reports a removed sanction, but not as an escalation", () => {
    const prev = buildWatchSnapshot(brief({ sanctions: { matches: [sanction("Old Co")] } as any }))
    const next = buildWatchSnapshot(brief())
    const changes = diffSnapshots(prev, next, ["sanctions"])
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ facet: "sanctions", kind: "removed", escalation: false })
  })

  it("restricts comparison to the selected checks' facets", () => {
    const prev = buildWatchSnapshot(brief({ identity: { flag: "PA" } as any, companies: [{ companyImo: "1", role: "Owner", roles: [], name: "A", address: null, sanctioned: false, parentSanctioned: false } as any] }))
    const next = buildWatchSnapshot(brief({ identity: { flag: "CM" } as any, companies: [{ companyImo: "2", role: "Owner", roles: [], name: "B", address: null, sanctioned: false, parentSanctioned: false } as any] }))
    // sanctions-only monitor: neither the flag nor the ownership change is reported
    expect(diffSnapshots(prev, next, ["sanctions"])).toEqual([])
    // flag monitor: only the flag change surfaces
    const flagOnly = diffSnapshots(prev, next, ["flag"])
    expect(flagOnly).toHaveLength(1)
    expect(flagOnly[0]!.facet).toBe("flag")
  })

  it("always compares the verdict and flags a worsening as an escalation", () => {
    const prev = buildWatchSnapshot(brief({ verdict: { decision: "CAUTION", score: 40, drivers: [], justification: "" } as any }))
    const next = buildWatchSnapshot(brief({ verdict: { decision: "BLOCK", score: 90, drivers: [], justification: "" } as any }))
    // even with no facets selected, verdict is compared
    const changes = diffSnapshots(prev, next, [])
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ facet: "verdict", kind: "changed", escalation: true })
  })

  it("flags a detention increase as an escalation", () => {
    const prev = buildWatchSnapshot(brief({ inspections: { total: 3, detentions: 0, deficiencies: 2, records: [] } as any }))
    const next = buildWatchSnapshot(brief({ inspections: { total: 4, detentions: 1, deficiencies: 5, records: [] } as any }))
    const changes = diffSnapshots(prev, next, ["inspections"])
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ facet: "inspections", escalation: true })
  })
})

describe("shouldNotify", () => {
  const escalation = { facet: "sanctions", kind: "added", label: "", before: null, after: null, escalation: true } as const
  const cosmetic = { facet: "flag", kind: "changed", label: "", before: null, after: null, escalation: false } as const

  it("all_changes fires on any change", () => {
    expect(shouldNotify([cosmetic], "all_changes")).toBe(true)
    expect(shouldNotify([], "all_changes")).toBe(false)
  })
  it("escalations_only fires only on a worsening", () => {
    expect(shouldNotify([cosmetic], "escalations_only")).toBe(false)
    expect(shouldNotify([cosmetic, escalation], "escalations_only")).toBe(true)
  })
})

describe("check → stage/facet mapping", () => {
  it("a sanctions check re-runs only the sanctions stage (no registry identify)", () => {
    expect(stagesForChecks(["sanctions"])).toEqual(["sanctions"])
    expect(facetsForChecks(["sanctions"])).toEqual(["verdict", "sanctions"])
  })
  it("an ownership check also watches the inferred-ownership facet", () => {
    expect(facetsForChecks(["ownership"])).toEqual(["verdict", "ownership", "inferredOwnership"])
  })
  it("a flag check is the one that must re-identify", () => {
    expect(stagesForChecks(["flag"])).toEqual(["identify"])
  })
})
