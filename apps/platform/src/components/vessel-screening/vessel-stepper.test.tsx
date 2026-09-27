import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { VesselStepper } from "./vessel-stepper"
import type { Screening } from "@talasa/shared"

function screening(steps: Screening["steps"], progress: Screening["progress"]): Screening {
  return {
    id: "s", name: "Test screening", imo: "9304162", status: "running", vesselName: "SUBJECT", flag: "Gabon",
    identity: null, graph: null, brief: null, steps, progress, modelMeta: null, error: null, archived: false,
    createdBy: "u", createdAt: "t", updatedAt: "t",
  }
}

// The progress view is intentionally generic — it must not leak the internal
// pipeline stages (identity/inspections/fleet/sanctions/ais/…).
const STAGE_WORDS = /identity|inspections|sister fleet|ownership|sanctions|ais|assessment/i

describe("VesselStepper", () => {
  it("shows an overall percentage from the reported progress", () => {
    render(
      <VesselStepper
        screening={screening(
          { identify: { status: "done", attempts: 1, durationMs: 1200 }, fleet: { status: "running", attempts: 1 } },
          { done: 2, total: 8 },
        )}
      />,
    )
    expect(screen.getByText(/Screening vessel/i)).toBeInTheDocument()
    expect(screen.getByText("25")).toBeInTheDocument() // 2 / 8
    expect(screen.queryByText(STAGE_WORDS)).toBeNull()
  })

  it("derives the percentage from step records when progress is absent", () => {
    render(
      <VesselStepper
        screening={screening(
          {
            identify: { status: "done", attempts: 1, durationMs: 1 },
            history: { status: "done", attempts: 1, durationMs: 1 },
          },
          null,
        )}
      />,
    )
    expect(screen.getByText("22")).toBeInTheDocument() // 2 done of 9 stages
  })

  it("does not surface a failed best-effort stage as an error", () => {
    render(
      <VesselStepper
        screening={screening({ sanctions: { status: "failed", attempts: 3 } }, { done: 0, total: 8 })}
      />,
    )
    expect(screen.getByText(/Screening vessel/i)).toBeInTheDocument()
    expect(screen.queryByText(STAGE_WORDS)).toBeNull()
  })
})
