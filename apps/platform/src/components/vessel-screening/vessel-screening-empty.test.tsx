import type { ReactNode } from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

// The CTA uses a TanStack <Link>, which needs a router context. Stub it as a
// plain anchor so the empty state can render in isolation (repo convention:
// Link-using components aren't wrapped in a router for unit tests).
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

import { VesselScreeningEmpty } from "./vessel-screening-empty"

describe("VesselScreeningEmpty", () => {
  it("renders the onboarding heading, steps, and a CTA to start a screening", () => {
    render(<VesselScreeningEmpty />)

    expect(screen.getByRole("heading", { name: /no screenings yet/i })).toBeInTheDocument()
    expect(screen.getByText(/7-digit IMO/i)).toBeInTheDocument()
    expect(screen.getByText(/full intelligence brief/i)).toBeInTheDocument()

    const cta = screen.getByRole("link", { name: /start a screening/i })
    expect(cta).toHaveAttribute("href", "/vessel-screening/new")
  })
})
