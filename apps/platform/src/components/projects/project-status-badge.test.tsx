import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS } from "@talasa/shared"
import { ProjectStatusBadge } from "./project-status-badge"

describe("ProjectStatusBadge", () => {
  it.each(PROJECT_STATUSES)("renders the human label for %s", (status) => {
    render(<ProjectStatusBadge status={status} />)
    expect(screen.getByText(PROJECT_STATUS_LABELS[status])).toBeTruthy()
  })
})
