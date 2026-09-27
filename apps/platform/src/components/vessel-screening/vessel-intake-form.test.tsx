import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { VesselIntakeForm } from "./vessel-intake-form"

describe("VesselIntakeForm", () => {
  it("submits the name and IMO once both are valid", async () => {
    const onSubmit = vi.fn()
    render(<VesselIntakeForm onSubmit={onSubmit} pending={false} />)
    const user = userEvent.setup()

    // IMO alone is not enough — a name is required.
    await user.type(screen.getByLabelText(/imo/i), "9304162")
    await user.click(screen.getByRole("button", { name: /screen/i }))
    expect(onSubmit).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText(/name/i), "Acme tanker")
    await user.click(screen.getByRole("button", { name: /screen/i }))
    expect(onSubmit).toHaveBeenCalledWith({ name: "Acme tanker", imo: "9304162" })
  })

  it("requires a name", async () => {
    const onSubmit = vi.fn()
    render(<VesselIntakeForm onSubmit={onSubmit} pending={false} />)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/imo/i), "9304162")
    await user.click(screen.getByRole("button", { name: /screen/i }))
    expect(screen.getByText(/name is required/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("shows an inline error for an invalid IMO", async () => {
    render(<VesselIntakeForm onSubmit={vi.fn()} pending={false} />)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/name/i), "Acme tanker")
    await user.type(screen.getByLabelText(/imo/i), "12")
    await user.click(screen.getByRole("button", { name: /screen/i }))
    expect(screen.getByText(/7 digits/i)).toBeInTheDocument()
  })
})
