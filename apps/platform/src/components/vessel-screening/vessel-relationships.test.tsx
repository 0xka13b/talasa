import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { EntityGraph, GraphNode } from "@talasa/shared"
import { VesselRelationships } from "./vessel-relationships"

const subject: GraphNode = { id: "imo:1", kind: "vessel", label: "SUBJECT", sub: "Gabon", sanctioned: false, isSubject: true, data: { imo: "1" } }
const ownerCo: GraphNode = { id: "company:owner", kind: "legal", label: "Owner Co", sub: "Registered owner", sanctioned: true, isSubject: false, data: { vesselCount: 2 } }
const mgmtCo: GraphNode = { id: "company:mgmt", kind: "legal", label: "Mgmt Co", sub: "ISM manager", sanctioned: false, isSubject: false, data: {} }
const sisterA: GraphNode = { id: "imo:2", kind: "vessel", label: "Sister A", sub: "Panama", sanctioned: true, isSubject: false, data: { imo: "2" } }

const graph: EntityGraph = {
  nodes: [subject, ownerCo, mgmtCo, sisterA],
  edges: [
    { from: "company:owner", to: "imo:1", rel: "registered_owner" },
    { from: "company:mgmt", to: "imo:1", rel: "ism_manager" },
    { from: "company:mgmt", to: "imo:1", rel: "commercial_manager" },
    { from: "company:owner", to: "imo:2", rel: "registered_owner" },
  ],
}

describe("VesselRelationships", () => {
  it("renders role-grouped sections with their companies", () => {
    render(<VesselRelationships graph={graph} onSelect={vi.fn()} />)
    expect(screen.getByText("Registered Owner")).toBeInTheDocument()
    expect(screen.getByText("ISM Manager")).toBeInTheDocument()
    expect(screen.getByText("Owner Co")).toBeInTheDocument()
    expect(screen.getByText("Mgmt Co")).toBeInTheDocument()
    // multi-role company shows its secondary role as a badge
    expect(screen.getByText("Commercial Manager")).toBeInTheDocument()
  })

  it("keeps the sister fleet collapsed until expanded", async () => {
    const user = userEvent.setup()
    render(<VesselRelationships graph={graph} onSelect={vi.fn()} />)
    const toggle = screen.getByRole("button", { name: /toggle fleet/i })
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    await user.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("Sister A")).toBeInTheDocument()
  })

  it("fires onSelect with the node when a company row is clicked", async () => {
    const onSelect = vi.fn()
    render(<VesselRelationships graph={graph} onSelect={onSelect} />)
    await userEvent.setup().click(screen.getByText("Owner Co"))
    expect(onSelect).toHaveBeenCalledWith(ownerCo)
  })

  it("shows an empty state when there are no relationships", () => {
    render(<VesselRelationships graph={{ nodes: [subject], edges: [] }} onSelect={vi.fn()} />)
    expect(screen.getByText(/no related entities/i)).toBeInTheDocument()
  })
})
