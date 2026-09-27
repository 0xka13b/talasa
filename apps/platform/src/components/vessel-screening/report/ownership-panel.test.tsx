import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { OwnershipPanel } from "./ownership-panel"
import type { VesselBrief } from "@talasa/shared"

function brief(companies: VesselBrief["companies"]): VesselBrief {
  return { companies } as VesselBrief
}

const enrichedCompany = {
  companyImo: "100", role: "ism manager", roles: ["ism manager"], name: "Acme", address: null, sanctioned: false,
  lei: "L1", legalName: "ACME LIMITED", jurisdiction: "GB", registrationStatus: "ISSUED",
  directParent: { lei: "P1", legalName: "ACME GROUP", jurisdiction: "GB" },
  ultimateParent: null, parentSanctioned: true,
}

describe("OwnershipPanel GLEIF info", () => {
  it("renders LEI, jurisdiction, registration status and the legal name", () => {
    render(<OwnershipPanel b={brief([enrichedCompany])} />)
    expect(screen.getByText("L1")).toBeInTheDocument()
    expect(screen.getByText(/ACME LIMITED/)).toBeInTheDocument()
    expect(screen.getByText(/GB/)).toBeInTheDocument()
    expect(screen.getByText(/ISSUED/)).toBeInTheDocument()
  })

  it("shows the parent owner with a Sanctioned badge when parentSanctioned", () => {
    render(<OwnershipPanel b={brief([enrichedCompany])} />)
    expect(screen.getByText(/ACME GROUP/)).toBeInTheDocument()
    expect(screen.getByText("Parent sanctioned")).toBeInTheDocument()
  })

  it("renders a plain company (no GLEIF data) without legal lines", () => {
    const plain = { companyImo: "9", role: "manager", roles: ["manager"], name: "Plain Co", address: null, sanctioned: false, parentSanctioned: false }
    render(<OwnershipPanel b={brief([plain as VesselBrief["companies"][number]])} />)
    expect(screen.getByText("Plain Co")).toBeInTheDocument()
    expect(screen.queryByText(/LEI/)).not.toBeInTheDocument()
  })
})

describe("OwnershipPanel inferred ownership", () => {
  function briefWith(inferred: VesselBrief["inferredOwnership"]): VesselBrief {
    return { companies: [], inferredOwnership: inferred } as unknown as VesselBrief
  }

  it("highlights an undisclosed-ownership flag even with no companies", () => {
    render(
      <OwnershipPanel
        b={briefWith({ flags: [{ role: "Commercial Manager", placeholder: "RPTD SOLD UNDISCLOSED INTEREST" }], entities: [], summary: "" })}
      />,
    )
    expect(screen.getByText(/Undisclosed registry ownership/i)).toBeInTheDocument()
    expect(screen.getByText("RPTD SOLD UNDISCLOSED INTEREST")).toBeInTheDocument()
  })

  it("renders the inferred network table with the not-registry-confirmed disclaimer", () => {
    render(
      <OwnershipPanel
        b={briefWith({
          flags: [{ role: "ISM Manager", placeholder: "UNKNOWN" }],
          entities: [{ name: "Fractal Marine DMCC", role: "Prior manager", signal: "Sanctioned intermediary.", strength: "strong" }],
          summary: "Shamkhani shadow-fleet network.",
        })}
      />,
    )
    expect(screen.getByText("Inferred ownership network")).toBeInTheDocument()
    expect(screen.getByText(/not registry-confirmed/i)).toBeInTheDocument()
    expect(screen.getByText("Fractal Marine DMCC")).toBeInTheDocument()
    expect(screen.getByText("Prior manager")).toBeInTheDocument()
  })

  it("shows the empty state when there are no companies and no flags", () => {
    render(<OwnershipPanel b={{ companies: [] } as unknown as VesselBrief} />)
    expect(screen.getByText(/No legal entities found/i)).toBeInTheDocument()
  })
})
