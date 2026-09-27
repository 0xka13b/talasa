import { describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LoginForm } from "./login-form"

describe("LoginForm", () => {
  it("submits entered credentials", () => {
    const onSubmit = vi.fn()
    render(<LoginForm pending={false} onSubmit={onSubmit} />)
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } })
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } })
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }))
    expect(onSubmit).toHaveBeenCalledWith({ email: "a@b.com", password: "password123" })
  })
})
