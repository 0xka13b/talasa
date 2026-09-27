import { describe, it, expect, vi } from "vitest"
import { detectUndisclosedOwnership, screenOwnership } from "./ownership"
import type { ManagementEntry } from "@talasa/equasis"
import type { VesselIdentity, VesselSanctionMatch } from "@talasa/shared"

function mgmt(role: string, name: string): ManagementEntry {
  return { companyImo: null, role, name, address: null, dateOfEffect: null }
}

const identity = {
  imo: "9298492", name: "SUBJECT", flag: "Panama", type: "Crude Oil Tanker",
} as VesselIdentity

describe("detectUndisclosedOwnership", () => {
  it("flags RPTD SOLD and UNKNOWN placeholders with a clean role label", () => {
    const flags = detectUndisclosedOwnership([
      { companyImo: "5553502", role: "Registered owner", name: "REAL OWNER CO", address: null, dateOfEffect: null },
      mgmt("Registered manager", "RPTD SOLD UNDISCLOSED INTEREST"),
      mgmt("Commercial manager", "RPTD SOLD UNDISCLOSED INTEREST"),
      mgmt("ISM Manager", "UNKNOWN"),
    ])
    expect(flags).toEqual([
      { role: "Registered manager", placeholder: "RPTD SOLD UNDISCLOSED INTEREST" },
      { role: "Commercial Manager", placeholder: "RPTD SOLD UNDISCLOSED INTEREST" },
      { role: "ISM Manager", placeholder: "UNKNOWN" },
    ])
  })

  it("ignores real companies and non-management roles", () => {
    expect(
      detectUndisclosedOwnership([
        { companyImo: "1", role: "Registered owner", name: "GENUINE SHIPPING LLC", address: null, dateOfEffect: null },
        mgmt("Classification society", "UNKNOWN"),
      ]),
    ).toEqual([])
  })
})

describe("screenOwnership", () => {
  const matches: VesselSanctionMatch[] = [
    {
      entity: "SUBJECT", list: "us_ofac", matchField: "imo", score: 1, tier: "hit", nodeId: "imo:9298492",
      description: "Vessel affiliated with Fractal Marine DMCC, part of the Shamkhani network.", notes: [],
    } as VesselSanctionMatch,
  ]

  it("returns null when there are no undisclosed flags (opt-in, no LLM call)", async () => {
    const inference = { inferOwnership: vi.fn() }
    const out = await screenOwnership([], identity, matches, { inference } as any)
    expect(out).toBeNull()
    expect(inference.inferOwnership).not.toHaveBeenCalled()
  })

  it("passes the sanctions narrative to the inference call and returns the network", async () => {
    const inference = {
      inferOwnership: vi.fn(async () => ({
        fields: {
          entities: [{ name: "Fractal Marine DMCC", role: "Prior manager", signal: "Sanctioned intermediary.", strength: "strong" }],
          summary: "Shamkhani shadow-fleet network.",
        },
        usage: { model: "m", inputTokens: 1, outputTokens: 1, cachedTokens: 0 },
      })),
    }
    const flags = [{ role: "ISM Manager", placeholder: "UNKNOWN" }]
    const out = await screenOwnership(flags, identity, matches, { inference } as any)
    expect(inference.inferOwnership).toHaveBeenCalledOnce()
    const arg = (inference.inferOwnership.mock.calls[0] as any[])[0]
    expect(arg.evidence[0].text).toContain("Fractal Marine")
    expect(out?.flags).toEqual(flags)
    expect(out?.entities[0]?.name).toBe("Fractal Marine DMCC")
  })

  it("keeps the flags even when there is no narrative to infer from", async () => {
    const inference = { inferOwnership: vi.fn() }
    const flags = [{ role: "Commercial Manager", placeholder: "RPTD SOLD UNDISCLOSED INTEREST" }]
    const out = await screenOwnership(flags, identity, [], { inference } as any)
    expect(inference.inferOwnership).not.toHaveBeenCalled()
    expect(out?.flags).toEqual(flags)
    expect(out?.entities).toEqual([])
  })

  it("degrades to flags-only when the inference call throws", async () => {
    const inference = { inferOwnership: vi.fn(async () => { throw new Error("boom") }) }
    const flags = [{ role: "ISM Manager", placeholder: "UNKNOWN" }]
    const out = await screenOwnership(flags, identity, matches, { inference } as any, { warn: () => {} })
    expect(out?.flags).toEqual(flags)
    expect(out?.entities).toEqual([])
  })
})
