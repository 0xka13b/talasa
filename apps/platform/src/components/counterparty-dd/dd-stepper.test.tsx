import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { DDStepper } from "./dd-stepper"

const project = (steps: Record<string, unknown>, progress = { done: 0, total: 5 }) =>
  ({ status: "running", steps, progress }) as never

// The progress view is intentionally generic — it must not leak the internal
// pipeline stages (resolve/network/ownership/sanctions/synthesize/…).
const STAGE_WORDS = /resolve|network|ownership|sanctions|synthesize/i

describe("DDStepper", () => {
  it("shows an overall percentage from the reported progress", () => {
    render(
      <DDStepper
        project={project(
          { resolve: { status: "done", attempts: 1, durationMs: 980 }, sanctions: { status: "running", attempts: 1 } },
          { done: 2, total: 5 },
        )}
      />,
    )
    expect(screen.getByText(/due diligence/i)).toBeInTheDocument()
    expect(screen.getByText("40")).toBeInTheDocument() // 2 / 5
    expect(screen.queryByText(STAGE_WORDS)).toBeNull()
  })

  it("does not surface a failed best-effort stage as an error", () => {
    render(
      <DDStepper
        project={project({ network: { status: "failed", attempts: 3, error: "equasis throttled" } })}
      />,
    )
    expect(screen.getByText(/due diligence/i)).toBeInTheDocument()
    expect(screen.queryByText(STAGE_WORDS)).toBeNull()
  })
})
