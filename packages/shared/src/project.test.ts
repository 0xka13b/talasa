import { describe, expect, it } from "vitest"
import { companySearchResultSchema, createProjectSchema, projectSchema, projectStatusSchema, PROJECT_STATUSES } from "./index.js"

describe("project contracts", () => {
  it("lists the five statuses in lifecycle order", () => {
    expect(PROJECT_STATUSES).toEqual(["draft", "queued", "running", "completed", "failed"])
  })
  it("accepts a minimal valid create payload", () => {
    const parsed = createProjectSchema.parse({
      counterpartyName: "Acme Shipping Ltd",
    })
    expect(parsed.companyImo ?? null).toBeNull()
  })
  it("rejects an empty counterparty name", () => {
    expect(() => createProjectSchema.parse({ counterpartyName: "" })).toThrow()
  })
  it("rejects an unknown status", () => {
    expect(() => projectStatusSchema.parse("archived")).toThrow()
  })
  it("createProjectSchema is counterparty-first (vesselName optional)", () => {
    const r = createProjectSchema.parse({ counterpartyName: "Acme Ltd" })
    expect(r.counterpartyName).toBe("Acme Ltd")
  })
  it("createProjectSchema accepts the picked-company anchor (imo + address)", () => {
    const r = createProjectSchema.parse({ counterpartyName: "Acme", companyImo: "9304162", companyAddress: "1 Marina Blvd, Singapore" })
    expect(r.companyImo).toBe("9304162")
    expect(r.companyAddress).toBe("1 Marina Blvd, Singapore")
  })
  it("companySearchResultSchema validates an Equasis search hit", () => {
    const hit = companySearchResultSchema.parse({ id: "0280911", name: "ARGOS NAUTES SHIPPING - FZCO", address: null })
    expect(hit.id).toBe("0280911")
    expect(hit.address).toBeNull()
  })
  it("projectSchema exposes steps + progress", () => {
    const base = { id: "p", name: "n", vesselName: null, vesselImo: null, vesselMmsi: null, companyImo: null, companyAddress: null, counterpartyName: "Acme", notes: null, status: "running", brief: null, error: null, createdBy: "u", createdAt: "t", updatedAt: "t", country: null, role: null, newsWindowDays: null, resolved: null, modelMeta: null, progress: { done: 2, total: 5 }, steps: { resolve: { status: "done", attempts: 1 } } }
    const p = projectSchema.parse(base)
    expect(p.progress?.done).toBe(2)
    expect(p.steps?.resolve?.status).toBe("done")
  })
})
