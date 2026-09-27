import { describe, it, expect } from "vitest"
import type { Node } from "@xyflow/react"
import type { EntityGraph, GraphBoard } from "@talasa/shared"
import { boardFromFlow, layoutPositions, makeAnnotationNode, miniMapNodeColor, toFlow, type BoardNode } from "./to-flow"

const graph: EntityGraph = {
  nodes: [
    { id: "imo:1", kind: "vessel", label: "SUBJECT", sub: "Gabon", sanctioned: false, isSubject: true, data: { imo: "1" } },
    { id: "company:A", kind: "legal", label: "OWNER CO", sub: "Registered owner", sanctioned: true, category: "sanctioned", isSubject: false, data: {} },
    { id: "imo:2", kind: "vessel", label: "SIS", sub: "Panama", sanctioned: false, category: "poi", isSubject: false, data: { imo: "2" } },
  ],
  edges: [
    { from: "company:A", to: "imo:1", rel: "registered_owner" },
    { from: "company:A", to: "imo:2", rel: "manager" },
  ],
}

describe("layoutPositions", () => {
  it("returns a finite position for every entity node", () => {
    const pos = layoutPositions(graph)
    for (const n of graph.nodes) {
      expect(pos[n.id]).toBeDefined()
      expect(Number.isFinite(pos[n.id].x)).toBe(true)
      expect(Number.isFinite(pos[n.id].y)).toBe(true)
    }
  })

  // A hub owning many vessels privately should fan them radially rather than
  // stretch them into one wide row.
  const bigFleet: EntityGraph = {
    nodes: [
      { id: "co", kind: "legal", label: "MEGA OWNER", sanctioned: false, isSubject: true, data: {} },
      ...Array.from({ length: 12 }, (_, i) => ({
        id: `v${i}`,
        kind: "vessel" as const,
        label: `V${i}`,
        sanctioned: false,
        isSubject: false,
        data: {},
      })),
    ],
    edges: Array.from({ length: 12 }, (_, i) => ({ from: "co", to: `v${i}`, rel: "manager" as const })),
  }

  it("fans a large private fleet around its hub instead of a single row", () => {
    const pos = layoutPositions(bigFleet)
    const hub = pos["co"]
    const fleet = Array.from({ length: 12 }, (_, i) => pos[`v${i}`])
    for (const p of fleet) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
    // Vessels surround the hub: some above and some below it (a row would put
    // them all on one horizontal line).
    const above = fleet.filter((p) => p.y < hub.y)
    const below = fleet.filter((p) => p.y > hub.y)
    expect(above.length).toBeGreaterThan(0)
    expect(below.length).toBeGreaterThan(0)
    // And they don't degenerate into one long horizontal line.
    const xs = fleet.map((p) => p.x)
    const ys = fleet.map((p) => p.y)
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(68)
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0)
  })

  it("leaves a small fleet in the layered backbone (no radial fan)", () => {
    const small: EntityGraph = {
      nodes: [
        { id: "co", kind: "legal", label: "CO", sanctioned: false, isSubject: true, data: {} },
        ...Array.from({ length: 3 }, (_, i) => ({
          id: `v${i}`,
          kind: "vessel" as const,
          label: `V${i}`,
          sanctioned: false,
          isSubject: false,
          data: {},
        })),
      ],
      edges: Array.from({ length: 3 }, (_, i) => ({ from: "co", to: `v${i}`, rel: "manager" as const })),
    }
    const pos = layoutPositions(small)
    // Layered TB layout puts all three children on one rank below the hub.
    const ys = [pos["v0"].y, pos["v1"].y, pos["v2"].y]
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(1)
  })
})

describe("toFlow", () => {
  it("maps every entity to a node carrying its GraphNode, and labels edges by role", () => {
    const { nodes, edges } = toFlow(graph, null)
    expect(nodes).toHaveLength(3)
    expect(nodes.every((n) => n.type === "entity")).toBe(true)
    const subject = nodes.find((n) => n.id === "imo:1")
    expect(subject?.type).toBe("entity")
    expect((subject?.data as { entity: { isSubject: boolean } }).entity.isSubject).toBe(true)
    expect(edges).toHaveLength(2)
    expect(edges.map((e) => e.label).sort()).toEqual(["Manager", "Registered Owner"])
  })

  it("prefers saved positions over the computed layout", () => {
    const board: GraphBoard = { version: 1, viewport: null, positions: { "company:A": { x: 999, y: -42 } }, annotations: [], edges: [] }
    const { nodes } = toFlow(graph, board)
    const co = nodes.find((n) => n.id === "company:A")
    expect(co?.position).toEqual({ x: 999, y: -42 })
  })

  it("appends saved annotations as text/box nodes", () => {
    const board: GraphBoard = {
      version: 1,
      viewport: null,
      positions: {},
      annotations: [
        { id: "a1", type: "text", position: { x: 10, y: 20 }, width: 180, height: 80, data: { text: "hello", color: null } },
        { id: "a2", type: "box", position: { x: 0, y: 0 }, width: 200, height: 120, data: { text: "", color: null } },
      ],
      edges: [],
    }
    const { nodes } = toFlow(graph, board)
    expect(nodes.find((n) => n.id === "a1")?.type).toBe("textNote")
    expect(nodes.find((n) => n.id === "a2")?.type).toBe("shapeBox")
    expect(nodes).toHaveLength(5)
  })

  it("renders saved board edges as distinct, selectable connector edges", () => {
    const board: GraphBoard = {
      version: 1,
      viewport: null,
      positions: {},
      annotations: [
        { id: "a1", type: "text", position: { x: 10, y: 20 }, width: 180, height: 80, data: { text: "linked", color: null } },
      ],
      edges: [{ id: "u1", source: "imo:1", target: "a1" }],
    }
    const { edges } = toFlow(graph, board)
    // 2 derived relationship edges + 1 user connector.
    expect(edges).toHaveLength(3)
    const user = edges.find((e) => e.id === "u1")
    expect(user?.type).toBe("connector")
    expect((user?.data as { board?: boolean } | undefined)?.board).toBe(true)
    expect(user?.selectable).toBe(true)
    // Derived edges stay read-only so a click can't delete graph structure.
    expect(edges.filter((e) => e.id !== "u1").every((e) => e.selectable === false)).toBe(true)
  })
})

describe("boardFromFlow", () => {
  it("round-trips entity positions and annotations, ignoring entity payloads", () => {
    const { nodes } = toFlow(graph, null)
    const moved: BoardNode[] = nodes.map((n) => (n.id === "imo:1" ? { ...n, position: { x: 5, y: 6 } } : n))
    const withNote = [...moved, makeAnnotationNode("note-1", "text", { x: 1, y: 2 })]
    const board = boardFromFlow(withNote, [], { x: 3, y: 4, zoom: 1.5 })
    expect(board.positions["imo:1"]).toEqual({ x: 5, y: 6 })
    expect(board.viewport).toEqual({ x: 3, y: 4, zoom: 1.5 })
    expect(board.annotations).toHaveLength(1)
    expect(board.annotations[0].id).toBe("note-1")
    expect(board.annotations[0].type).toBe("text")
    expect(board.edges).toEqual([])
  })

  it("persists only user connectors (data.board), never derived relationship edges", () => {
    const { nodes, edges } = toFlow(graph, {
      version: 1,
      viewport: null,
      positions: {},
      annotations: [],
      edges: [{ id: "u1", source: "imo:1", target: "company:A" }],
    })
    const board = boardFromFlow(nodes, edges, null)
    expect(board.edges).toEqual([{ id: "u1", source: "imo:1", target: "company:A" }])
  })
})

describe("makeAnnotationNode", () => {
  it("builds a text note and a box with the right node types", () => {
    expect(makeAnnotationNode("x", "text", { x: 0, y: 0 }).type).toBe("textNote")
    expect(makeAnnotationNode("y", "box", { x: 0, y: 0 }).type).toBe("shapeBox")
  })
})

describe("miniMapNodeColor", () => {
  const asNode = (entity: Record<string, unknown>) => ({ data: { entity } }) as unknown as Node
  it("colours entities by sanction category — direct red, softer amber, else neutral", () => {
    expect(miniMapNodeColor(asNode({ category: "sanctioned" }))).toBe("#ef4444")
    expect(miniMapNodeColor(asNode({ category: "poi" }))).toBe("#f59e0b")
    expect(miniMapNodeColor(asNode({ category: "sanction_linked" }))).toBe("#f59e0b")
    expect(miniMapNodeColor(asNode({ sanctioned: true }))).toBe("#ef4444")
    expect(miniMapNodeColor(asNode({ sanctioned: false }))).toBe("#94a3b8")
  })
  it("falls back to a neutral colour for annotation nodes", () => {
    expect(miniMapNodeColor({ data: {} } as unknown as Node)).toBe("#cbd5e1")
  })
})
