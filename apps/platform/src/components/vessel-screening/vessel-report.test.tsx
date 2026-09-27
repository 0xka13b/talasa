import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { VesselReport } from "./vessel-report"
import type { VesselBrief } from "@talasa/shared"

function brief(over: Partial<VesselBrief> = {}): VesselBrief {
  return {
    screeningId: "s", imo: "9304162", generatedAt: "t", reportVersion: "1.0", geography: [],
    identity: { imo: "9304162", name: "SUBJECT", flag: "Gabon", type: "Tanker", grossTonnage: 50000, deadweight: 90000, yearBuilt: "2006", classSociety: null, mmsi: null, callSign: null, status: "In Service", riskyFlag: true, detentionRate: "12 %", parisMou: "Black", tokyoMou: null },
    companies: [{ companyImo: "5553502", role: "Registered owner", roles: ["Registered owner"], name: "OWNER CO", address: "Piraeus", sanctioned: false, parentSanctioned: false }],
    fleet: { companies: [{ companyImo: "5553502", name: "OWNER CO", vesselCount: 4, sampledCount: 2, sanctionedCount: 1 }], sisters: [{ imo: "5555555", name: "SIS", flag: "Gabon", type: "Tanker", sanctioned: true }], truncated: true, note: "2 not detailed" },
    sanctions: { status: "CONFIRMED", subjectHit: false, companyHits: [], sisterHits: [{ imo: "5555555", name: "SIS" }], matches: [{ entity: "BAD", list: "us_ofac_sdn", matchField: "imo", score: 0.97, tier: "hit", nodeId: "imo:5555555" }], narrative: "sn" },
    signals: [{ kind: "sister_sanction", severity: "strong", detail: "Sister IMO 5555555 sanctioned" }, { kind: "risky_flag", severity: "weak", detail: "Gabon" }],
    verdict: { decision: "CAUTION", score: 45, drivers: ["fleet.sister_sanctioned", "flag.high_risk"], justification: "Verdict CAUTION." },
    executiveSummary: "exec", prediction: "predictive narrative", recommendation: "rec",
    dataCompleteness: { sourcesOk: ["equasis_identity"], gaps: ["ais_history", "sanctions"] }, modelMeta: null,
    ...over,
  }
}

describe("VesselReport", () => {
  it("shows the verdict bar and the LLM overview on load", () => {
    render(<VesselReport brief={brief()} graph={null} />)
    // Verdict bar — always visible, outside the tabs.
    expect(screen.getByText("CAUTION")).toBeInTheDocument()
    expect(screen.getByText(/45/)).toBeInTheDocument()
    // Overview is the default tab: the LLM narratives.
    expect(screen.getByText("rec")).toBeInTheDocument()
    expect(screen.getByText("exec")).toBeInTheDocument()
    expect(screen.getByText("predictive narrative")).toBeInTheDocument()
  })

  it("humanizes machine codes in the overview", () => {
    render(<VesselReport brief={brief()} graph={null} />)
    expect(screen.getByText(/OFAC SDN \(US\)/)).toBeInTheDocument() // sanctions dataset id
    expect(screen.getByText("Fleet — Sister sanctioned")).toBeInTheDocument() // verdict driver
    expect(screen.getByText("AIS history")).toBeInTheDocument() // data gap
    expect(screen.queryByText("ais_history")).not.toBeInTheDocument()
  })

  it("falls back gracefully on an unparseable brief", () => {
    render(<VesselReport brief={{ junk: true }} graph={null} />)
    expect(screen.getByText(/unavailable/i)).toBeInTheDocument()
  })

  it("shows full particulars on the Vessel tab", async () => {
    render(<VesselReport brief={brief()} graph={null} />)
    await userEvent.setup().click(screen.getByRole("tab", { name: /vessel/i }))
    expect(screen.getByText("In Service")).toBeInTheDocument()
    expect(screen.getByText("Year built")).toBeInTheDocument()
  })

  it("pins and tags the registered owner on the Ownership tab", async () => {
    render(<VesselReport brief={brief()} graph={null} />)
    await userEvent.setup().click(screen.getByRole("tab", { name: /ownership/i }))
    expect(screen.getByText("OWNER CO")).toBeInTheDocument()
    expect(screen.getByText("Registered owner")).toBeInTheDocument()
  })

  it("lists sanctioned sisters on the Sister fleet tab", async () => {
    render(<VesselReport brief={brief()} graph={null} />)
    await userEvent.setup().click(screen.getByRole("tab", { name: /sister fleet/i }))
    expect(screen.getByText("SIS")).toBeInTheDocument()
    expect(screen.getByText("Directly sanctioned")).toBeInTheDocument()
  })

  it("switches to the Graph tab (empty graph)", async () => {
    render(<VesselReport brief={brief()} graph={null} />)
    await userEvent.setup().click(screen.getByRole("tab", { name: /graph/i }))
    expect(screen.getByText(/no graph/i)).toBeInTheDocument()
  })

  it("mounts the graph board (not the empty state) from a real graph", async () => {
    const graph = {
      nodes: [
        { id: "imo:9304162", kind: "vessel", label: "SUBJECT", sub: "Gabon", sanctioned: false, isSubject: true, data: {} },
        { id: "company:1", kind: "legal", label: "OWNER CO", sub: "Registered owner", sanctioned: false, isSubject: false, data: {} },
      ],
      edges: [{ from: "company:1", to: "imo:9304162", rel: "registered_owner" }],
    }
    render(<VesselReport brief={brief()} graph={graph} />)
    await userEvent.setup().click(screen.getByRole("tab", { name: /graph/i }))
    // The List view is gone: a real graph takes the board branch (code-split +
    // client-only), so the empty state must not appear.
    expect(screen.queryByText(/no graph/i)).not.toBeInTheDocument()
  })
})
