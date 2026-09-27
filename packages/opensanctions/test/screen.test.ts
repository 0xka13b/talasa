import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { buildScreeningResult, classifyCategory, worstDecision } from "../src/screen"
import { matchResponseSchema } from "../src/types"
import type { ScreenTarget } from "../src/types"

const here = dirname(fileURLToPath(import.meta.url))
const response = matchResponseSchema.parse(
  JSON.parse(readFileSync(join(here, "fixtures/match-response.json"), "utf8")),
)

function resultsFor(key: string) {
  return response.responses[key]?.results ?? []
}

describe("decision ladder", () => {
  it("identifier-tier vessel with a sanctions topic -> hit", () => {
    const target: ScreenTarget = { kind: "vessel", imo: "9999999" }
    const result = buildScreeningResult(target, resultsFor("q0"))
    expect(result.decision).toBe("hit")
    expect(result.matches[0]?.sanctioned).toBe(true)
    expect(result.matches[0]?.datasets).toContain("us_ofac_sdn")
  })

  it("a directly-designated vessel is category 'sanctioned' and carries all lists + dates", () => {
    const target: ScreenTarget = { kind: "vessel", imo: "9999999" }
    const m = buildScreeningResult(target, resultsFor("q0")).matches[0]
    expect(m?.category).toBe("sanctioned")
    expect(m?.datasets).toEqual(["us_ofac_sdn", "eu_fsf"])
    expect(m?.firstSeen).toBe("2021-05-01")
    expect(m?.lastSeen).toBe("2024-03-10")
    expect(m?.lastChange).toBe("2024-02-28")
  })

  it("name-tier company with a sanctions topic -> review (never auto-reject)", () => {
    const target: ScreenTarget = { kind: "company", name: "ACME SHIPPING LTD" }
    expect(buildScreeningResult(target, resultsFor("q1")).decision).toBe("review")
  })

  it("a sanction.linked company is category 'sanction_linked', NOT directly sanctioned", () => {
    const target: ScreenTarget = { kind: "company", name: "ACME SHIPPING LTD" }
    const m = buildScreeningResult(target, resultsFor("q1")).matches[0]
    // Surfaced for review (topic is a RISK_TOPIC), but must read as linked — not listed itself.
    expect(m?.sanctioned).toBe(true)
    expect(m?.category).toBe("sanction_linked")
  })

  it("PEP-only match is informational -> clear", () => {
    const target: ScreenTarget = { kind: "person", name: "JANE POLITICIAN" }
    const result = buildScreeningResult(target, resultsFor("q2"))
    expect(result.decision).toBe("clear")
    expect(result.matches[0]?.sanctioned).toBe(false)
    expect(result.matches[0]?.category).toBe("pep")
  })

  it("no candidates -> clear", () => {
    const target: ScreenTarget = { kind: "company", name: "CLEAN CO" }
    expect(buildScreeningResult(target, resultsFor("q3")).decision).toBe("clear")
  })
})

describe("designation narrative capture", () => {
  it("captures the FtM notes array and prefers the description property for the summary", () => {
    const target: ScreenTarget = { kind: "vessel", imo: "9999999" }
    const m = buildScreeningResult(target, resultsFor("q0")).matches[0]
    expect(m?.notes).toEqual(["Seized attempting to evade the oil price cap."])
    expect(m?.description).toBe(
      "Tanker designated for exporting crude in breach of the price cap.",
    )
  })

  it("falls back to the first note when there is no description property", () => {
    const target: ScreenTarget = { kind: "company", name: "ACME SHIPPING LTD" }
    const m = buildScreeningResult(target, resultsFor("q1")).matches[0]
    expect(m?.notes).toEqual(["Owner of record for a sanctioned vessel."])
    expect(m?.description).toBe("Owner of record for a sanctioned vessel.")
  })

  it("is empty notes / null description when the entity carries neither", () => {
    const target: ScreenTarget = { kind: "person", name: "JANE POLITICIAN" }
    const m = buildScreeningResult(target, resultsFor("q2")).matches[0]
    expect(m?.notes).toEqual([])
    expect(m?.description).toBeNull()
  })
})

describe("classifyCategory", () => {
  it("direct designation wins over a link on the same entity", () => {
    expect(classifyCategory(["sanction.linked", "sanction"])).toBe("sanctioned")
  })
  it("export controls count as a direct designation", () => {
    expect(classifyCategory(["export.control"])).toBe("sanctioned")
  })
  it("linked-only is 'sanction_linked' (the owner-of-a-sanctioned-vessel case)", () => {
    expect(classifyCategory(["sanction.linked", "poi"])).toBe("sanction_linked")
  })
  it("PEP roles map to 'pep'", () => {
    expect(classifyCategory(["role.pep"])).toBe("pep")
    expect(classifyCategory(["role.rca"])).toBe("pep")
  })
  it("entity of interest maps to 'poi'", () => {
    expect(classifyCategory(["poi"])).toBe("poi")
  })
  it("anything else is 'other'", () => {
    expect(classifyCategory(["debarment"])).toBe("other")
    expect(classifyCategory([])).toBe("other")
  })
})

describe("worstDecision", () => {
  it("rolls up to the most severe decision", () => {
    expect(worstDecision(["clear", "review", "hit", "clear"])).toBe("hit")
    expect(worstDecision(["clear", "review"])).toBe("review")
    expect(worstDecision(["clear", "clear"])).toBe("clear")
    expect(worstDecision([])).toBe("clear")
  })
})
