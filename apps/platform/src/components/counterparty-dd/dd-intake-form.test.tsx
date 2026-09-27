import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DDIntakeForm } from "./dd-intake-form"
import { apiFetch } from "@/lib/api"

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }))
const mockedApiFetch = vi.mocked(apiFetch)

function renderForm(onSubmit: (input: unknown) => void, pending = false) {
  // A fresh client with retries off so a rejected search fails fast in tests.
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <DDIntakeForm pending={pending} onSubmit={onSubmit as never} />
    </QueryClientProvider>
  )
}

describe("DDIntakeForm", () => {
  beforeEach(() => {
    mockedApiFetch.mockReset()
  })

  it("renders the search field + Search button and disables Run initially", () => {
    renderForm(vi.fn())
    expect(screen.getByLabelText(/company name/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^search$/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /run due diligence/i })).toBeDisabled()
  })

  it("searches, lists companies, and submits the selected one's identity", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    mockedApiFetch.mockResolvedValue([
      { id: "C-100", name: "Acme Shipping Ltd", address: "5 Marina Way, Valletta" },
      { id: "C-200", name: "Acme Marine SA", address: null },
    ])
    renderForm(onSubmit)

    await user.type(screen.getByLabelText(/company name/i), "Acme")
    await user.click(screen.getByRole("button", { name: /^search$/i }))

    // The mutation hit the endpoint with the encoded query.
    expect(mockedApiFetch).toHaveBeenCalledWith("/api/equasis/company?name=Acme")

    expect(await screen.findByText("Acme Shipping Ltd")).toBeInTheDocument()
    expect(screen.getByText("Acme Marine SA")).toBeInTheDocument()
    expect(screen.getByText("address unknown")).toBeInTheDocument()

    // Run is enabled once a company is picked.
    await user.click(screen.getByText("Acme Shipping Ltd"))
    const runBtn = screen.getByRole("button", { name: /run due diligence/i })
    expect(runBtn).toBeEnabled()

    await user.click(runBtn)
    expect(onSubmit).toHaveBeenCalledTimes(1)
    const arg = onSubmit.mock.calls[0][0]
    expect(arg.counterpartyName).toBe("Acme Shipping Ltd")
    expect(arg.companyImo).toBe("C-100")
    expect(arg.companyAddress).toBe("5 Marina Way, Valletta")
    expect(arg.role).toBeUndefined()
    expect(arg.notes).toBeUndefined()
  })

  it("offers a no-match fallback that screens the typed name with no companyImo", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    mockedApiFetch.mockResolvedValue([])
    renderForm(onSubmit)

    await user.type(screen.getByLabelText(/company name/i), "Obscure Trading")
    await user.click(screen.getByRole("button", { name: /^search$/i }))

    const fallback = await screen.findByRole("button", {
      name: /screen .*obscure trading.* without a registry match/i,
    })
    await user.click(fallback)

    const runBtn = screen.getByRole("button", { name: /run due diligence/i })
    expect(runBtn).toBeEnabled()
    await user.click(runBtn)

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const arg = onSubmit.mock.calls[0][0]
    expect(arg.counterpartyName).toBe("Obscure Trading")
    expect(arg.companyImo).toBeUndefined()
    expect(arg.companyAddress).toBeUndefined()
  })

  it("surfaces a search error with the same fallback", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    mockedApiFetch.mockRejectedValue(new Error("Equasis unavailable"))
    renderForm(onSubmit)

    await user.type(screen.getByLabelText(/company name/i), "Acme")
    await user.click(screen.getByRole("button", { name: /^search$/i }))

    expect(await screen.findByText(/company search is unavailable/i)).toBeInTheDocument()
    await user.click(
      screen.getByRole("button", { name: /screen .*acme.* without a registry match/i })
    )
    await user.click(screen.getByRole("button", { name: /run due diligence/i }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0].companyImo).toBeUndefined()
  })

  it("re-disables Run when the query is edited after a pick (no stale/empty submit)", async () => {
    // Regression: previously, picking the free-text fallback then clearing/editing
    // the box left Run enabled and submitted an empty counterpartyName.
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    mockedApiFetch.mockResolvedValue([])
    renderForm(onSubmit)

    const input = screen.getByLabelText(/company name/i)
    await user.type(input, "Obscure Trading")
    await user.click(screen.getByRole("button", { name: /^search$/i }))
    await user.click(
      await screen.findByRole("button", { name: /screen .*obscure trading.* without a registry match/i })
    )
    expect(screen.getByRole("button", { name: /run due diligence/i })).toBeEnabled()

    // Editing the box invalidates the pick — Run must re-disable.
    await user.type(input, " Ltd")
    expect(screen.getByRole("button", { name: /run due diligence/i })).toBeDisabled()
  })

  it("offers a typed-name escape hatch even when Equasis returns (wrong) results", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    mockedApiFetch.mockResolvedValue([{ id: "C-9", name: "Unrelated Co", address: null }])
    renderForm(onSubmit)

    await user.type(screen.getByLabelText(/company name/i), "Argos Nautes")
    await user.click(screen.getByRole("button", { name: /^search$/i }))
    await screen.findByText("Unrelated Co")

    await user.click(screen.getByRole("button", { name: /none of these.*argos nautes.* as typed/i }))
    const runBtn = screen.getByRole("button", { name: /run due diligence/i })
    expect(runBtn).toBeEnabled()
    await user.click(runBtn)

    const arg = onSubmit.mock.calls[0][0]
    expect(arg.counterpartyName).toBe("Argos Nautes")
    expect(arg.companyImo).toBeUndefined()
  })
})
