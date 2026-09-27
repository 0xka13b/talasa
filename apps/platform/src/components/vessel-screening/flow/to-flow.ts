import dagre from "@dagrejs/dagre"
import { MarkerType, type Edge, type Node } from "@xyflow/react"
import type { EntityGraph, GraphBoard, GraphBoardAnnotation, GraphNode } from "@talasa/shared"
import { ROLE_LABEL, type Rel } from "../build-relationships"
import { isDirectSanction } from "../vessel-labels"

// ---- node data + typed node unions ----
export interface EntityNodeData extends Record<string, unknown> {
  entity: GraphNode
}
export interface AnnotationNodeData extends Record<string, unknown> {
  annotation: GraphBoardAnnotation
}

export type EntityFlowNode = Node<EntityNodeData, "entity">
export type TextFlowNode = Node<AnnotationNodeData, "textNote">
export type ShapeFlowNode = Node<AnnotationNodeData, "shapeBox">
export type BoardNode = EntityFlowNode | TextFlowNode | ShapeFlowNode

// Approx. rendered box used purely for the layout pass (real cards auto-size).
const NODE_W = 210
const NODE_H = 68

// Paint order (higher = on top): grouping boxes sit behind the entity cards,
// sticky notes float above them.
const Z_BOX = 0
const Z_ENTITY = 1
const Z_NOTE = 2

// ---- radial "mind-map" clustering ----
// When a single entity (an owner / ISM / commercial manager) holds many vessels,
// a plain layered layout spreads them into one very wide row. Instead, fan those
// vessels out on concentric rings AROUND the hub so a large fleet reads as a
// compact cluster rather than a line stretching off-screen.
//
// FAN_MIN — only cluster once a hub's private fleet exceeds this; smaller fleets
// read fine as a normal dagre row and avoid reserving a big empty circle.
const FAN_MIN = 6
const FAN_R0 = 240 // radius of the innermost ring, from the hub centre
const FAN_RING_GAP = 150 // radial gap between concentric rings
const FAN_SLOT = NODE_W + 40 // arc length reserved per vessel on a ring

/**
 * Place `n` items on concentric rings around a centre, filling each ring to its
 * arc-length capacity before starting the next. Returns polar offsets (radius +
 * angle) in item order; alternate rings are half-slot rotated so nodes interleave
 * radially instead of lining up. Pure/deterministic.
 */
function ringOffsets(n: number): { radius: number; angle: number }[] {
  const out: { radius: number; angle: number }[] = []
  let placed = 0
  let ring = 0
  while (placed < n) {
    const radius = FAN_R0 + ring * FAN_RING_GAP
    const capacity = Math.max(1, Math.floor((2 * Math.PI * radius) / FAN_SLOT))
    const count = Math.min(capacity, n - placed)
    const stagger = ring % 2 ? Math.PI / count : 0
    for (let i = 0; i < count; i++) {
      // Start at the top (−90°) and sweep clockwise for a stable, symmetric fan.
      out.push({ radius, angle: (2 * Math.PI * i) / count + stagger - Math.PI / 2 })
    }
    placed += count
    ring++
  }
  return out
}

/**
 * Identify "hubs": entities that privately own many vessels. A vessel is a
 * fan-child of a hub when it is a leaf (no outgoing edges), not the subject, and
 * connected to exactly one company — moving such a vessel can't distort any other
 * relationship. Vessels shared across companies (e.g. the subject) stay in the
 * layered backbone. Returns hubId → deterministically-ordered child vessel ids,
 * limited to hubs above {@link FAN_MIN}.
 */
function findFanHubs(graph: EntityGraph): Map<string, string[]> {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const hasOutgoing = new Set(graph.edges.map((e) => e.from))
  // vessel id -> distinct company parents
  const parentsOf = new Map<string, Set<string>>()
  for (const e of graph.edges) {
    if (byId.get(e.to)?.kind !== "vessel") continue
    const set = parentsOf.get(e.to) ?? new Set<string>()
    set.add(e.from)
    parentsOf.set(e.to, set)
  }

  const children = new Map<string, string[]>()
  for (const n of graph.nodes) {
    if (n.kind !== "vessel" || n.isSubject || hasOutgoing.has(n.id)) continue
    const parents = parentsOf.get(n.id)
    if (!parents || parents.size !== 1) continue
    const hub = [...parents][0]
    const arr = children.get(hub) ?? []
    arr.push(n.id)
    children.set(hub, arr)
  }

  const hubs = new Map<string, string[]>()
  for (const [hub, ids] of children) {
    if (ids.length >= FAN_MIN) hubs.set(hub, [...ids].sort())
  }
  return hubs
}

/**
 * Deterministic layout mixing a top-to-bottom layered backbone with radial
 * "mind-map" clusters. The graph is a shallow DAG (parents → companies →
 * subject/sisters), so dagre lays out the skeleton — parents above the companies
 * and vessels they control. But a hub with a large private fleet ({@link
 * findFanHubs}) has its vessels lifted out of that layered pass and fanned on
 * concentric rings around the hub; dagre reserves a square the size of the
 * cluster for the hub so the rest of the backbone routes cleanly around it.
 * Stable on every load. Returns entity nodeId → top-left position.
 */
export function layoutPositions(graph: EntityGraph): Record<string, { x: number; y: number }> {
  const hubs = findFanHubs(graph)
  // Precompute each hub's ring offsets + the square it needs reserved in dagre.
  const hubOffsets = new Map<string, { radius: number; angle: number }[]>()
  const hubBox = new Map<string, number>()
  for (const [hub, children] of hubs) {
    const offsets = ringOffsets(children.length)
    const outer = Math.max(...offsets.map((o) => o.radius))
    hubOffsets.set(hub, offsets)
    hubBox.set(hub, 2 * outer + NODE_W)
  }
  const fanned = new Set<string>()
  for (const children of hubs.values()) for (const id of children) fanned.add(id)

  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: "TB", nodesep: 48, ranksep: 96, marginx: 16, marginy: 16 })
  g.setDefaultEdgeLabel(() => ({}))
  for (const n of graph.nodes) {
    if (fanned.has(n.id)) continue // positioned radially below, not by dagre
    const box = hubBox.get(n.id)
    g.setNode(n.id, box ? { width: box, height: box } : { width: NODE_W, height: NODE_H })
  }
  // Parallel edges (e.g. ISM + commercial) collapse for layout — multiplicity
  // doesn't matter to positioning; the rendered edges keep every role. Edges to
  // fanned vessels are dropped here and drawn radially from the hub instead.
  for (const e of graph.edges) {
    if (fanned.has(e.from) || fanned.has(e.to)) continue
    g.setEdge(e.from, e.to)
  }
  dagre.layout(g)

  const out: Record<string, { x: number; y: number }> = {}
  for (const n of graph.nodes) {
    if (fanned.has(n.id)) continue
    const p = g.node(n.id)
    if (p) out[n.id] = { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 }
  }
  // Fan each hub's fleet around the hub's (reserved-box) centre.
  for (const [hub, children] of hubs) {
    const p = g.node(hub)
    if (!p) continue
    const offsets = hubOffsets.get(hub)!
    children.forEach((id, i) => {
      const { radius, angle } = offsets[i]
      out[id] = {
        x: p.x + radius * Math.cos(angle) - NODE_W / 2,
        y: p.y + radius * Math.sin(angle) - NODE_H / 2,
      }
    })
  }
  return out
}

/**
 * Build React Flow {nodes, edges} from the entity graph plus the user's saved
 * board overlay. Entity positions come from the saved board when present, else
 * the computed layout; annotations are appended verbatim. This is a pure
 * function so it can be unit-tested without a DOM.
 */
export function toFlow(graph: EntityGraph, board: GraphBoard | null): { nodes: BoardNode[]; edges: Edge[] } {
  const layout = layoutPositions(graph)
  const saved = board?.positions ?? {}

  const entityNodes: EntityFlowNode[] = graph.nodes.map((n) => ({
    id: n.id,
    type: "entity",
    position: saved[n.id] ?? layout[n.id] ?? { x: 0, y: 0 },
    data: { entity: n },
    zIndex: Z_ENTITY,
  }))

  const annotationNodes: BoardNode[] = (board?.annotations ?? []).map((a) =>
    a.type === "text"
      ? ({
          id: a.id,
          type: "textNote",
          position: { ...a.position },
          width: a.width,
          height: a.height,
          data: { annotation: a },
          zIndex: Z_NOTE,
        } satisfies TextFlowNode)
      : ({
          id: a.id,
          type: "shapeBox",
          position: { ...a.position },
          width: a.width,
          height: a.height,
          data: { annotation: a },
          zIndex: Z_BOX,
        } satisfies ShapeFlowNode),
  )

  // Derived relationship edges: labelled, arrow-headed, and read-only (not
  // selectable) so a click never deletes the entity graph's own structure.
  const derivedEdges: Edge[] = graph.edges.map((e, i) => ({
    id: `e${i}-${e.from}-${e.to}-${e.rel}`,
    source: e.from,
    target: e.to,
    label: ROLE_LABEL[e.rel as Rel] ?? e.rel,
    labelShowBg: true,
    labelBgPadding: [4, 2] as [number, number],
    labelBgBorderRadius: 4,
    markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
    selectable: false,
  }))

  // User-drawn connectors: a distinct dashed, arrow-less edge type. Tagged with
  // `data.board` so {@link boardFromFlow} can tell them apart from the derived
  // edges above and persist only these.
  const userEdges: Edge[] = (board?.edges ?? []).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: "connector",
    data: { board: true },
    selectable: true,
    deletable: true,
    zIndex: Z_NOTE,
  }))

  // Boxes first so, at equal z, they paint behind; entities/notes are elevated
  // by explicit zIndex anyway.
  return { nodes: [...annotationNodes, ...entityNodes], edges: [...derivedEdges, ...userEdges] }
}

/**
 * Reverse of {@link toFlow}: serialize the live React Flow nodes + edges +
 * viewport back into a persistable board overlay. Only entity positions,
 * annotations and the user-drawn connectors are captured — never the entity
 * payloads or the derived relationship edges (those regenerate from the
 * screening).
 */
export function boardFromFlow(nodes: BoardNode[], edges: Edge[], viewport: GraphBoard["viewport"]): GraphBoard {
  const positions: Record<string, { x: number; y: number }> = {}
  const annotations: GraphBoardAnnotation[] = []
  for (const n of nodes) {
    if (n.type === "entity") {
      positions[n.id] = { x: n.position.x, y: n.position.y }
    } else {
      const a = n.data.annotation
      annotations.push({
        ...a,
        position: { x: n.position.x, y: n.position.y },
        width: n.width ?? n.measured?.width ?? a.width,
        height: n.height ?? n.measured?.height ?? a.height,
      })
    }
  }
  const userEdges = edges
    .filter((e) => (e.data as { board?: boolean } | undefined)?.board)
    .map((e) => ({ id: e.id, source: e.source, target: e.target }))
  return { version: 1, viewport: viewport ?? null, positions, annotations, edges: userEdges }
}

/**
 * Create a fresh annotation node at a canvas position. `id` is caller-supplied
 * (crypto.randomUUID) to keep this pure/deterministic in tests.
 */
export function makeAnnotationNode(id: string, kind: "text" | "box", position: { x: number; y: number }): BoardNode {
  const base: GraphBoardAnnotation = {
    id,
    type: kind,
    position,
    width: kind === "text" ? 180 : 240,
    height: kind === "text" ? 80 : 160,
    data: { text: kind === "text" ? "Note" : "", color: null },
  }
  return kind === "text"
    ? ({ id, type: "textNote", position: { ...position }, width: base.width, height: base.height, data: { annotation: base }, zIndex: Z_NOTE } satisfies TextFlowNode)
    : ({ id, type: "shapeBox", position: { ...position }, width: base.width, height: base.height, data: { annotation: base }, zIndex: Z_BOX } satisfies ShapeFlowNode)
}

// ---- canvas colour (minimap): the <canvas> can't use Tailwind classes, so it
// mirrors the report's category palette by hand — direct sanction red, any other
// category (linked / PEP / POI) amber, otherwise neutral. ----
export function miniMapNodeColor(node: Node): string {
  const entity = (node.data as Partial<EntityNodeData> | undefined)?.entity
  if (!entity) return "#cbd5e1"
  if (isDirectSanction(entity.category ?? undefined)) return "#ef4444"
  if (entity.category) return "#f59e0b"
  if (entity.sanctioned) return "#ef4444"
  return "#94a3b8"
}
