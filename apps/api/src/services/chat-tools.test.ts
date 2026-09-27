import { describe, expect, it } from "vitest"
import type { Subject } from "./chat-context"
import { buildTools } from "./chat-tools"

// Minimal stand-ins for the drizzle row types; buildTools only reads brief/graph.
function vesselSubject(brief: unknown, graph?: unknown): Subject {
  return { kind: "screening", row: { brief, graph } as never }
}
function ddSubject(brief: unknown): Subject {
  return { kind: "project", row: { brief } as never }
}

// The AI SDK `tool()` wrapper stores the fn under `.execute`.
async function run(tools: Record<string, { execute: (a: any) => unknown }>, name: string, args: any = {}) {
  const tool = tools[name]
  if (!tool) throw new Error(`tool ${name} not found`)
  return tool.execute(args)
}

describe("chat tools — vessel", () => {
  const brief = {
    verdict: { decision: "BLOCK", score: 100, drivers: ["sanctioned owner"], justification: "x" },
    executiveSummary: "summary",
    sanctions: { status: "CONFIRMED", subjectHit: true, matches: [], narrative: "n" },
    companies: [{ name: "Acme Shipping", role: "registered owner", sanctioned: true }],
  }
  const graph = { nodes: [{ id: "n1", kind: "legal", label: "Acme", sanctioned: true }], edges: [{ from: "n1", to: "n2", rel: "parent" }] }

  it("get_overview returns verdict + summary", async () => {
    const out: any = await run(buildTools(vesselSubject(brief)) as any, "get_overview")
    expect(out.verdict.decision).toBe("BLOCK")
    expect(out.executiveSummary).toBe("summary")
  })

  it("get_sanctions returns the sanctions section", async () => {
    const out: any = await run(buildTools(vesselSubject(brief)) as any, "get_sanctions")
    expect(out.status).toBe("CONFIRMED")
  })

  it("returns { available: false } for a missing section", async () => {
    const out: any = await run(buildTools(vesselSubject({})) as any, "get_ais_events")
    expect(out.available).toBe(false)
  })

  it("get_overview reports unavailable when there is no brief", async () => {
    const out: any = await run(buildTools(vesselSubject(null)) as any, "get_overview")
    expect(out.available).toBe(false)
  })

  it("list_entities + get_entity read the top-level graph", async () => {
    const tools = buildTools(vesselSubject(brief, graph)) as any
    const list: any = await run(tools, "list_entities")
    expect(list.entities[0].id).toBe("n1")
    const entity: any = await run(tools, "get_entity", { id: "n1" })
    expect(entity.node.label).toBe("Acme")
    expect(entity.edges).toHaveLength(1)
  })
})

describe("chat tools — DD", () => {
  const brief = {
    riskScore: { value: 80, band: "REJECT", drivers: [], justification: "y" },
    executiveSummary: "dd summary",
    linkedCompanies: [{ name: "Linked Co" }],
    graph: { nodes: [{ id: "c1", kind: "legal", label: "Linked Co" }], edges: [] },
  }

  it("get_overview returns riskScore + recommended action", async () => {
    const out: any = await run(buildTools(ddSubject(brief)) as any, "get_overview")
    expect(out.riskScore.band).toBe("REJECT")
  })

  it("get_corporate_network returns linked companies", async () => {
    const out: any = await run(buildTools(ddSubject(brief)) as any, "get_corporate_network")
    expect(out.linkedCompanies[0].name).toBe("Linked Co")
  })

  it("list_entities reads the graph nested in the DD brief", async () => {
    const list: any = await run(buildTools(ddSubject(brief)) as any, "list_entities")
    expect(list.entities[0].id).toBe("c1")
  })
})
