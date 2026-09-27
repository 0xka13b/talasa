import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { VesselGraphSidebar } from "./vessel-graph-sidebar"

describe("VesselGraphSidebar", () => {
  it("shows the selected node's label + detail and closes", async () => {
    const onClose = vi.fn()
    render(<VesselGraphSidebar node={{ id: "imo:9304162", kind: "vessel", label: "SUBJECT", sub: "Gabon", sanctioned: false, isSubject: true, data: { imo: "9304162", flag: "Gabon" } }} onClose={onClose} />)
    expect(screen.getByText("SUBJECT")).toBeInTheDocument()
    expect(screen.getByText(/9304162/)).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole("button", { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it("renders human-readable field labels, not raw camelCase keys", () => {
    render(
      <VesselGraphSidebar
        node={{
          id: "company:1",
          kind: "legal",
          label: "GRIGOR MARITIME CO SA",
          sub: "Greece",
          sanctioned: false,
          isSubject: false,
          data: { companyImo: "0270769", riskyFlag: true, roles: ["ISM Manager", "Registered owner"] },
        }}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText("Company IMO")).toBeInTheDocument()
    expect(screen.queryByText("companyImo")).toBeNull()
    expect(screen.getByText("High-risk flag")).toBeInTheDocument()
    expect(screen.getByText("Yes")).toBeInTheDocument() // boolean → Yes/No
    expect(screen.getByText("ISM Manager, Registered owner")).toBeInTheDocument() // array → joined
  })
})
