import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { VesselVerdictBadge } from "./vessel-verdict-badge"

describe("VesselVerdictBadge", () => {
  it("renders each verdict label", () => {
    render(<VesselVerdictBadge verdict="PROCEED" />)
    expect(screen.getByText("PROCEED")).toBeInTheDocument()
  })
  it("colors BLOCK with the destructive palette", () => {
    render(<VesselVerdictBadge verdict="BLOCK" />)
    expect(screen.getByText("BLOCK").className).toMatch(/red/)
  })
})
