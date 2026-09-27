import type { ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { FleetPanel } from "./fleet-panel"
import type { VesselBrief } from "@talasa/shared"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

function brief(sisters: VesselBrief["fleet"]["sisters"]): VesselBrief {
  return {
    fleet: { companies: [], sisters, truncated: false, note: null },
  } as unknown as VesselBrief
}

const sanctionedShip = {
  imo: "111", name: "Dark Runner", flag: "Panama", type: "Tanker",
  sanctioned: true, category: "sanctioned" as const,
}
const concernShip = {
  imo: "222", name: "Grey Zone", flag: "Comoros", type: "Bulk carrier",
  sanctioned: false, category: "poi" as const,
}
const cleanShip = {
  imo: "333", name: "Blue Horizon", flag: "Liberia", type: "Tanker",
  sanctioned: false, category: null,
}

describe("FleetPanel filters and search", () => {
  it("renders all sisters by default with no filter/search UI for a single sister", () => {
    render(<FleetPanel b={brief([sanctionedShip])} />)
    expect(screen.getByText("Dark Runner")).toBeInTheDocument()
    expect(screen.queryByLabelText("Search sister vessels")).not.toBeInTheDocument()
  })

  it("filters the list by search query across name, IMO, flag and type", async () => {
    const user = userEvent.setup()
    render(<FleetPanel b={brief([sanctionedShip, concernShip, cleanShip])} />)

    await user.type(screen.getByLabelText("Search sister vessels"), "comoros")

    expect(screen.getByText("Grey Zone")).toBeInTheDocument()
    expect(screen.queryByText("Dark Runner")).not.toBeInTheDocument()
    expect(screen.queryByText("Blue Horizon")).not.toBeInTheDocument()
    expect(screen.getByText("Showing 1 of 3")).toBeInTheDocument()
  })

  it("filters the list by status via the filter menu", async () => {
    const user = userEvent.setup()
    render(<FleetPanel b={brief([sanctionedShip, concernShip, cleanShip])} />)

    await user.click(screen.getByLabelText("Filter sister vessels"))
    await user.click(await screen.findByText("Clean"))

    expect(screen.getByText("Blue Horizon")).toBeInTheDocument()
    expect(screen.queryByText("Dark Runner")).not.toBeInTheDocument()
    expect(screen.queryByText("Grey Zone")).not.toBeInTheDocument()
  })

  it("shows a no-match state with a way to clear filters", async () => {
    const user = userEvent.setup()
    render(<FleetPanel b={brief([sanctionedShip, concernShip, cleanShip])} />)

    await user.type(screen.getByLabelText("Search sister vessels"), "nonexistent")

    expect(
      screen.getByText(/No sister vessels match your search or filters/)
    ).toBeInTheDocument()

    await user.click(screen.getByText("Clear filters"))
    expect(screen.getByText("Dark Runner")).toBeInTheDocument()
    expect(screen.getByText("Grey Zone")).toBeInTheDocument()
    expect(screen.getByText("Blue Horizon")).toBeInTheDocument()
  })
})
