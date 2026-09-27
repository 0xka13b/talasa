import type { ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { DDBrief } from "./dd-brief"

// The Fleet tab's "Screen vessel" CTA uses a TanStack <Link>, which needs a
// router context. Stub it as a plain anchor so the panel renders in isolation.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

const validBrief = {
  caseId: "dd_20260627_acme_shipping_12345678",
  generatedAt: "2026-06-27T10:00:00.000Z",
  reportVersion: "1.0",
  dataCompleteness: {
    sourcesOk: ["equasis", "opensanctions"],
    gaps: ["corporate_ownership"],
  },
  counterparty: {
    queryName: "Acme Shipping",
    canonicalName: "Acme Shipping Ltd",
    aliases: ["Acme Marine"],
    country: "MT",
    resolutionConfidence: 0.92,
    equasisCompanyId: "C-9988",
  },
  fleet: [
    {
      imo: "9876543",
      name: "MV Acme",
      flag: "MT",
      type: "Bulk Carrier",
      registeredOwner: "Acme Shipping Ltd",
      manager: "Acme Mgmt",
    },
  ],
  affiliations: {
    nodes: [{ name: "John Doe", role: "Director", country: "MT" }],
    edges: [{ from: "John Doe", to: "Acme Shipping Ltd", via: "directorship" }],
    narrative: "Closely held ownership.",
  },
  sanctions: {
    status: "CONFIRMED" as const,
    matches: [
      {
        entity: "Acme Shipping Ltd",
        list: "us_ofac_sdn",
        matchField: "name",
        score: 0.98,
        tier: 1 as const,
      },
    ],
    narrative: "Direct match on OFAC SDN list.",
  },
  linkedCompanies: [
    {
      companyImo: "C-7766",
      name: "Beta Owner Ltd",
      roles: ["Registered Owner"],
      sharedVesselImos: ["9876543"],
      sanctioned: false,
      address: "5 Marina Way",
      fleetCount: 4,
      fleet: [
        {
          imo: "9111111",
          name: "MV Beta One",
          flag: "PA",
          type: "Tanker",
          registeredOwner: null,
          manager: null,
        },
      ],
    },
  ],
  incidents: {
    detentions: [
      {
        imo: "9876543",
        authority: "Paris MoU",
        date: "2026-04-10",
        detail: "Deficiencies found",
      },
    ],
    gaps: [],
  },
  riskScore: {
    value: 88,
    band: "REJECT" as const,
    drivers: ["sanctions match", "detention"],
    justification: "Confirmed sanctions exposure.",
  },
  recommendedAction: {
    decision: "REJECT" as const,
    rationale: "Do not onboard.",
  },
  executiveSummary: "Acme Shipping Ltd presents unacceptable risk.",
  modelMeta: {
    model: "claude",
    inputTokens: 100,
    outputTokens: 50,
    cachedTokens: 0,
  },
}

describe("DDBrief", () => {
  it("shows the band, score, recommended action, sanction, and a gap chip on the default Overview tab", () => {
    render(<DDBrief brief={validBrief} />)
    expect(screen.getAllByText("REJECT").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("88")).toBeInTheDocument()
    expect(screen.getByText(/\/\s*100/)).toBeInTheDocument()
    expect(screen.getByText("Do not onboard.")).toBeInTheDocument()
    expect(
      screen.getAllByText("Acme Shipping Ltd").length
    ).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/OFAC SDN/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("Corporate ownership")).toBeInTheDocument()
  })

  it("surfaces a linked company and its own fleet size on the Network tab", async () => {
    render(<DDBrief brief={validBrief} />)
    await userEvent.setup().click(screen.getByRole("tab", { name: /network/i }))
    expect(screen.getByText("Beta Owner Ltd")).toBeInTheDocument()
    expect(screen.getByText(/operates 4 vessels/i)).toBeInTheDocument()
  })

  it("lists the fleet and detentions on the Fleet tab", async () => {
    render(<DDBrief brief={validBrief} />)
    await userEvent.setup().click(screen.getByRole("tab", { name: /fleet/i }))
    expect(screen.getByText("MV Acme")).toBeInTheDocument()
    expect(screen.getByText(/Paris MoU/)).toBeInTheDocument()
  })

  it("renders a graceful fallback on safeParse failure", () => {
    render(<DDBrief brief={{ junk: 1 }} />)
    expect(screen.getByText(/brief unavailable/i)).toBeInTheDocument()
  })
})
