import { render, screen, fireEvent } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { DDRunView } from "./dd-run-view"

const validBrief = {
  caseId: "dd_20260627_acme_shipping_12345678",
  generatedAt: "2026-06-27T10:00:00.000Z",
  reportVersion: "1.0",
  dataCompleteness: { sourcesOk: ["equasis", "opensanctions"], gaps: [] },
  counterparty: {
    queryName: "Acme Shipping",
    canonicalName: "Acme Shipping Ltd",
    aliases: [],
    country: "MT",
    resolutionConfidence: 0.92,
    equasisCompanyId: null,
  },
  fleet: [],
  affiliations: { nodes: [], edges: [], narrative: "" },
  sanctions: { status: "NO_MATCH" as const, matches: [], narrative: "" },
  incidents: { detentions: [], gaps: [] },
  riskScore: { value: 12, band: "CLEAR" as const, drivers: [], justification: "" },
  recommendedAction: { decision: "CLEAR" as const, rationale: "Low risk." },
  executiveSummary: "Acme Shipping Ltd presents low risk.",
  modelMeta: { model: "claude", inputTokens: 100, outputTokens: 50, cachedTokens: 0 },
}

const project = (over: Record<string, unknown>) =>
  ({
    id: "p1",
    counterpartyName: "Acme Shipping Ltd",
    companyImo: null,
    steps: {},
    progress: null,
    brief: null,
    error: null,
    ...over,
  } as never)

describe("DDRunView", () => {
  it("renders the stepper while running", () => {
    render(<DDRunView project={project({ status: "running" })} onRun={() => {}} runPending={false} />)
    expect(screen.getByText("Resolve")).toBeInTheDocument()
  })

  it("renders the brief when completed", () => {
    render(<DDRunView project={project({ status: "completed", brief: validBrief })} onRun={() => {}} runPending={false} />)
    expect(screen.getAllByText("CLEAR").length).toBeGreaterThanOrEqual(1)
  })

  it("renders the error and a Retry button when failed", () => {
    const onRun = vi.fn()
    render(<DDRunView project={project({ status: "failed", error: "boom" })} onRun={onRun} runPending={false} />)
    expect(screen.getByText("boom")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /retry/i }))
    expect(onRun).toHaveBeenCalledOnce()
  })

  it("renders a Run due diligence button when draft", () => {
    const onRun = vi.fn()
    render(<DDRunView project={project({ status: "draft" })} onRun={onRun} runPending={false} />)
    fireEvent.click(screen.getByRole("button", { name: /run due diligence/i }))
    expect(onRun).toHaveBeenCalledOnce()
  })
})
