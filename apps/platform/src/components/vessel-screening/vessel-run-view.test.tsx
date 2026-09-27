import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { VesselRunView } from "./vessel-run-view"
import type { Screening } from "@talasa/shared"

function s(status: Screening["status"], over: Partial<Screening> = {}): Screening {
  return { id: "s", name: "Test screening", imo: "9304162", status, vesselName: null, flag: null, identity: null, graph: null, brief: null, steps: {}, progress: null, modelMeta: null, error: null, archived: false, createdBy: "u", createdAt: "t", updatedAt: "t", ...over }
}

describe("VesselRunView", () => {
  it("shows the stepper while running", () => {
    render(<VesselRunView screening={s("running")} onRun={vi.fn()} runPending={false} />)
    expect(screen.getByText(/Screening vessel/i)).toBeInTheDocument()
  })
  it("shows an error card + retry when failed", () => {
    render(<VesselRunView screening={s("failed", { error: "boom" })} onRun={vi.fn()} runPending={false} />)
    expect(screen.getByText("boom")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument()
  })
  it("offers a run button in draft", () => {
    render(<VesselRunView screening={s("draft")} onRun={vi.fn()} runPending={false} />)
    expect(screen.getByRole("button", { name: /screen/i })).toBeInTheDocument()
  })
})
