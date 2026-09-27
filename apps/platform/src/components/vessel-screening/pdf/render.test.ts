import { describe, it, expect } from "vitest"
import type { VesselBrief, EntityGraph } from "@talasa/shared"
import { buildBriefPdfBlob } from "./index"

const FIXTURE: VesselBrief = {
  screeningId: "scr_123",
  imo: "9123456",
  generatedAt: "2026-06-29T10:00:00.000Z",
  reportVersion: "v1",
  geography: [],
  identity: {
    imo: "9123456",
    name: "MV Test Star",
    flag: "Panama",
    type: "Crude Oil Tanker",
    grossTonnage: 80000,
    deadweight: 150000,
    yearBuilt: "2009",
    classSociety: "DNV",
    mmsi: "353000000",
    callSign: "3FAB1",
    status: "In service",
    riskyFlag: false,
    detentionRate: "2.1%",
    parisMou: "Medium risk",
    tokyoMou: null,
  },
  companies: [
    {
      companyImo: "5000001",
      role: "registered owner",
      roles: ["registered owner"],
      name: "Acme Shipping Ltd",
      address: "Monrovia",
      sanctioned: false,
      parentSanctioned: false,
    },
    {
      companyImo: null,
      role: "ism manager",
      roles: ["ism manager"],
      name: "Beta Mgmt",
      address: null,
      sanctioned: true,
      parentSanctioned: false,
    },
  ],
  fleet: {
    companies: [
      {
        companyImo: "5000001",
        name: "Acme Shipping Ltd",
        vesselCount: 12,
        sampledCount: 5,
        sanctionedCount: 1,
      },
    ],
    sisters: [
      {
        imo: "9222222",
        name: "MV Sister",
        flag: "Liberia",
        type: "Tanker",
        sanctioned: true,
      },
    ],
    truncated: true,
    note: "Fleet truncated to first 50 vessels.",
  },
  sanctions: {
    status: "POSSIBLE",
    subjectHit: false,
    companyHits: ["Beta Mgmt"],
    sisterHits: [{ imo: "9222222", name: "MV Sister" }],
    matches: [
      {
        entity: "Beta Mgmt",
        list: "us_ofac_sdn",
        matchField: "name",
        score: 0.86,
        tier: "review",
        nodeId: "n1",
      },
    ],
    narrative: "One possible company-level match requires manual review.",
  },
  signals: [
    {
      kind: "fleet_sanction",
      severity: "strong",
      detail: "A sister vessel appears on a sanctions list.",
    },
    { kind: "flag", severity: "weak", detail: "Flag of convenience." },
  ],
  verdict: {
    decision: "CAUTION",
    score: 58,
    drivers: ["fleet.sister_sanctioned", "ownership.opaque"],
    justification: "Mixed signals.",
  },
  executiveSummary: "Vessel presents moderate risk driven by fleet exposure.",
  prediction: "Elevated likelihood of secondary sanctions exposure.",
  recommendation: "Proceed only after enhanced due diligence on Beta Mgmt.",
  dataCompleteness: {
    sourcesOk: ["equasis", "open_sanctions"],
    gaps: ["ais_history"],
  },
  modelMeta: null,
}

const GRAPH: EntityGraph = {
  nodes: [
    {
      id: "v1",
      kind: "vessel",
      label: "MV Test Star",
      sub: null,
      sanctioned: false,
      isSubject: true,
      data: { imo: "9123456" },
    },
    {
      id: "c1",
      kind: "legal",
      label: "Acme Shipping Ltd",
      sub: null,
      sanctioned: false,
      isSubject: false,
      data: { vesselCount: 12 },
    },
  ],
  edges: [{ from: "c1", to: "v1", rel: "registered_owner" }],
}

describe("buildBriefPdfBlob", () => {
  it("renders a non-empty PDF blob for a complete brief", async () => {
    const blob = await buildBriefPdfBlob(FIXTURE, GRAPH)
    expect(blob.size).toBeGreaterThan(1000)
    expect(blob.type).toContain("pdf")
  })

  it("still renders when the brief is sparse and the graph is missing", async () => {
    const sparse: VesselBrief = {
      ...FIXTURE,
      identity: {
        ...FIXTURE.identity,
        name: null,
        mmsi: null,
        callSign: null,
        detentionRate: null,
        parisMou: null,
        tokyoMou: null,
      },
      companies: [],
      fleet: { companies: [], sisters: [], truncated: false, note: null },
      sanctions: {
        ...FIXTURE.sanctions,
        status: "NO_MATCH",
        matches: [],
        narrative: "",
      },
      signals: [],
      dataCompleteness: { sourcesOk: [], gaps: [] },
    }
    const blob = await buildBriefPdfBlob(sparse, null)
    expect(blob.size).toBeGreaterThan(1000)
  })

  // Regression: a data-heavy vessel (long sister fleet + history) produced a
  // document long enough that react-pdf mis-resolved the container height for the
  // `fixed` bottom-anchored page footer, emitting a garbage coordinate (~1e21)
  // that aborted the whole export with "unsupported number". The footer is now
  // anchored from the top of the page; this asserts a many-page brief still renders.
  it("renders a long, multi-page brief without a layout overflow", async () => {
    const big: VesselBrief = {
      ...FIXTURE,
      history: {
        flagChanges: 5,
        nameChanges: 3,
        entries: Array.from({ length: 40 }, (_, i) => ({
          kind: i % 3 === 0 ? "flag" : i % 3 === 1 ? "ism_manager" : "registered_owner",
          value: `HISTORY VALUE ${i} WITH A FAIRLY LONG COMPANY NAME LLC`,
          from: `0${(i % 9) + 1}/0${(i % 9) + 1}/20${10 + (i % 15)}`,
        })),
      } as unknown as VesselBrief["history"],
      inspections: {
        total: 30,
        detentions: 2,
        deficiencies: 44,
        records: Array.from({ length: 30 }, (_, i) => ({
          authority: "United States of America",
          port: `New Orleans, Louisiana ${i}`,
          date: `1${i % 9}/0${(i % 9) + 1}/20${10 + (i % 15)}`,
          deficiencies: i % 4,
          detained: i % 15 === 0,
        })),
      } as unknown as VesselBrief["inspections"],
      signals: Array.from({ length: 22 }, (_, i) => ({
        kind: `signal_${i}`,
        severity: (["blocking", "strong", "weak"] as const)[i % 3],
        detail: `Sister vessel IMO 10${String(i).padStart(5, "0")} tied to sanctions — long detail line ${i}`,
      })),
      fleet: {
        ...FIXTURE.fleet,
        companies: FIXTURE.fleet.companies,
        sisters: Array.from({ length: 200 }, (_, i) => ({
          imo: String(1000000 + i),
          name: `SISTER VESSEL WITH A LONG NAME ${i}`,
          flag: i % 2 === 0 ? "Panama" : "Virgin Islands (U.K)",
          type: "Chemical/Oil Products Tanker",
          sanctioned: i % 20 === 0,
        })),
        truncated: true,
        note: "Some sisters listed but not detailed.",
      },
    }
    const blob = await buildBriefPdfBlob(big, GRAPH)
    expect(blob.size).toBeGreaterThan(1000)
    expect(blob.type).toContain("pdf")
  })
})
