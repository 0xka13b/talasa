import "@xyflow/react/dist/style.css"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react"
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type NodeMouseHandler,
  type Viewport,
} from "@xyflow/react"
import {
  IconCheck,
  IconFilter,
  IconLoader2,
  IconMaximize,
  IconMinimize,
  IconNote,
  IconRotate,
  IconSquare,
} from "@tabler/icons-react"
import type { EntityGraph, GraphBoard, GraphNode } from "@talasa/shared"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { isDirectSanction } from "../vessel-labels"
import { VesselGraphSidebar } from "../vessel-graph-sidebar"
import { BoardProvider, type BoardActions } from "./board-context"
import { EntityNode } from "./entity-node"
import { ShapeBoxNode, TextNoteNode } from "./annotation-nodes"
import { BoardConnectorEdge } from "./connector-edge"
import {
  boardFromFlow,
  makeAnnotationNode,
  miniMapNodeColor,
  toFlow,
  type BoardNode,
} from "./to-flow"

// Stable references — remounting nodeTypes/edgeTypes each render de-optimises React Flow.
const nodeTypes = {
  entity: EntityNode,
  textNote: TextNoteNode,
  shapeBox: ShapeBoxNode,
}
const edgeTypes = { connector: BoardConnectorEdge }

// Map React Flow's control/minimap chrome onto the app's design tokens so it
// tracks the light/dark theme alongside `colorMode` below.
const RF_THEME_VARS = {
  "--xy-controls-button-background-color": "var(--background)",
  "--xy-controls-button-background-color-hover": "var(--muted)",
  "--xy-controls-button-color": "var(--foreground)",
  "--xy-controls-button-color-hover": "var(--foreground)",
  "--xy-controls-button-border-color": "var(--border)",
  "--xy-minimap-background-color": "var(--background)",
} as CSSProperties

const SAVE_DEBOUNCE_MS = 900

// ---- entity filters. Each key maps to a predicate over a graph node; the board
// highlights nodes matching ANY active key (OR) and dims the rest. An empty
// selection means "no filter" — everything at full opacity. ----
type FilterKey =
  | "vessel"
  | "legal"
  | "sanctioned"
  | "sanction_linked"
  | "pep"
  | "poi"

const FILTER_GROUPS: { label: string; options: { key: FilterKey; label: string }[] }[] = [
  {
    label: "Entity type",
    options: [
      { key: "vessel", label: "Vessels" },
      { key: "legal", label: "Companies / entities" },
    ],
  },
  {
    label: "Sanctions & risk",
    options: [
      { key: "sanctioned", label: "Sanctioned" },
      { key: "sanction_linked", label: "Sanction-linked" },
      { key: "pep", label: "PEP" },
      { key: "poi", label: "Person of interest" },
    ],
  },
]

function matchesFilterKey(entity: GraphNode, key: FilterKey): boolean {
  switch (key) {
    case "vessel":
      return entity.kind === "vessel"
    case "legal":
      return entity.kind === "legal"
    case "sanctioned":
      return isDirectSanction(entity.category ?? undefined) || (entity.sanctioned && !entity.category)
    case "sanction_linked":
      return entity.category === "sanction_linked"
    case "pep":
      return entity.category === "pep"
    case "poi":
      return entity.category === "poi"
  }
}

function entityMatchesFilters(entity: GraphNode, active: Set<FilterKey>): boolean {
  if (active.size === 0) return true
  for (const key of active) {
    if (matchesFilterKey(entity, key)) return true
  }
  return false
}

const DIMMED_STYLE: CSSProperties = { opacity: 0.15, transition: "opacity 150ms ease" }
const LIT_STYLE: CSSProperties = { opacity: 1, transition: "opacity 150ms ease" }

/**
 * The app toggles dark mode by adding the `dark` class to <html>. React Flow's
 * `colorMode` needs a concrete "light"/"dark", so mirror that class and stay in
 * sync with live theme switches via a MutationObserver. Only mounts client-side
 * (the board is code-split behind a hydration guard), so `document` is safe.
 */
function useColorMode(): "light" | "dark" {
  const [mode, setMode] = useState<"light" | "dark">(() =>
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
      ? "dark"
      : "light"
  )
  useEffect(() => {
    const el = document.documentElement
    const update = () =>
      setMode(el.classList.contains("dark") ? "dark" : "light")
    update()
    const obs = new MutationObserver(update)
    obs.observe(el, { attributes: true, attributeFilter: ["class"] })
    return () => obs.disconnect()
  }, [])
  return mode
}

export interface VesselGraphBoardProps {
  graph: EntityGraph
  initialBoard: GraphBoard | null
  /** Persist callback (the parent owns the mutation); omit for a read-only board. */
  onSaveBoard?: (board: GraphBoard) => void
  /** Parent's in-flight save state, folded into the indicator. */
  saving?: boolean
}

export function VesselGraphBoard(props: VesselGraphBoardProps) {
  return (
    <ReactFlowProvider>
      <BoardInner {...props} />
    </ReactFlowProvider>
  )
}

function BoardInner({
  graph,
  initialBoard,
  onSaveBoard,
  saving,
}: VesselGraphBoardProps) {
  // Seed once — subsequent parent re-renders (e.g. the post-save refetch) must
  // NOT wipe in-progress edits. A genuine re-screen is handled by the graphKey
  // effect below.
  const [seed] = useState(() => toFlow(graph, initialBoard))
  const [nodes, setNodes, onNodesChange] = useNodesState<BoardNode>(seed.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(seed.edges)
  const [selected, setSelected] = useState<GraphNode | null>(null)
  const [dirty, setDirty] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [filters, setFilters] = useState<Set<FilterKey>>(() => new Set())

  const rf = useReactFlow()
  const colorMode = useColorMode()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const edgesRef = useRef(edges)
  edgesRef.current = edges
  const viewportRef = useRef<Viewport | null>(initialBoard?.viewport ?? null)
  const interactedRef = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced autosave. Reads the latest nodes/viewport off refs at fire time.
  const commit = useCallback(() => {
    if (!onSaveBoard) return
    setDirty(true)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      onSaveBoard(
        boardFromFlow(nodesRef.current, edgesRef.current, viewportRef.current)
      )
      setDirty(false)
    }, SAVE_DEBOUNCE_MS)
  }, [onSaveBoard])

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    },
    []
  )

  // Re-seed only when the underlying entity set actually changes (a re-screen),
  // preserving the user's annotations and re-laying-out the new entities.
  const graphKey = useMemo(
    () => graph.nodes.map((n) => n.id).join("|"),
    [graph]
  )
  const lastKey = useRef(graphKey)
  useEffect(() => {
    if (lastKey.current === graphKey) return
    lastKey.current = graphKey
    const { annotations, edges: userEdges } = boardFromFlow(
      nodesRef.current,
      edgesRef.current,
      viewportRef.current
    )
    const next = toFlow(graph, {
      version: 1,
      viewport: viewportRef.current,
      positions: {},
      annotations,
      edges: userEdges,
    })
    setNodes(next.nodes)
    setEdges(next.edges)
  }, [graphKey, graph, setNodes, setEdges])

  const updateAnnotationText = useCallback(
    (id: string, text: string) => {
      setNodes((ns) =>
        ns.map((n) =>
          n.id === id && n.type === "textNote"
            ? {
                ...n,
                data: {
                  annotation: {
                    ...n.data.annotation,
                    data: { ...n.data.annotation.data, text },
                  },
                },
              }
            : n
        )
      )
      commit()
    },
    [setNodes, commit]
  )

  const updateAnnotationColor = useCallback(
    (id: string, color: string | null) => {
      setNodes((ns) =>
        ns.map((n) =>
          n.id === id && (n.type === "textNote" || n.type === "shapeBox")
            ? {
                ...n,
                data: {
                  annotation: {
                    ...n.data.annotation,
                    data: { ...n.data.annotation.data, color },
                  },
                },
              }
            : n
        )
      )
      commit()
    },
    [setNodes, commit]
  )

  const removeAnnotation = useCallback(
    (id: string) => {
      setNodes((ns) => ns.filter((n) => n.id !== id))
      // Drop any connectors dangling off the removed annotation.
      setEdges((es) => es.filter((e) => e.source !== id && e.target !== id))
      setSelected(null)
      commit()
    },
    [setNodes, setEdges, commit]
  )

  const removeEdge = useCallback(
    (id: string) => {
      setEdges((es) => es.filter((e) => e.id !== id))
      commit()
    },
    [setEdges, commit]
  )

  const boardActions = useMemo<BoardActions>(
    () => ({
      updateAnnotationText,
      updateAnnotationColor,
      removeAnnotation,
      removeEdge,
      commit,
    }),
    [
      updateAnnotationText,
      updateAnnotationColor,
      removeAnnotation,
      removeEdge,
      commit,
    ]
  )

  // A user drags between two handles → persist a distinct board connector.
  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || c.source === c.target) return
      setEdges((es) => {
        if (
          es.some(
            (e) =>
              e.data?.board && e.source === c.source && e.target === c.target
          )
        )
          return es
        return addEdge(
          {
            id: crypto.randomUUID(),
            source: c.source,
            target: c.target,
            type: "connector",
            data: { board: true },
            selectable: true,
            deletable: true,
          },
          es
        )
      })
      commit()
    },
    [setEdges, commit]
  )

  const addAnnotation = useCallback(
    (kind: "text" | "box") => {
      const rect = wrapperRef.current?.getBoundingClientRect()
      const center = rect
        ? rf.screenToFlowPosition({
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          })
        : { x: 0, y: 0 }
      const node = makeAnnotationNode(crypto.randomUUID(), kind, center)
      setNodes((ns) => [...ns, node])
      commit()
    },
    [rf, setNodes, commit]
  )

  const resetLayout = useCallback(() => {
    const { annotations, edges: userEdges } = boardFromFlow(
      nodesRef.current,
      edgesRef.current,
      viewportRef.current
    )
    const next = toFlow(graph, {
      version: 1,
      viewport: viewportRef.current,
      positions: {},
      annotations,
      edges: userEdges,
    })
    setNodes(next.nodes)
    commit()
    requestAnimationFrame(() => rf.fitView({ padding: 0.2, duration: 300 }))
  }, [graph, rf, setNodes, commit])

  const onNodeClick = useCallback<NodeMouseHandler<BoardNode>>((_, node) => {
    if (node.type === "entity") setSelected(node.data.entity)
  }, [])

  const onNodeDragStop = useCallback(() => commit(), [commit])

  const onMoveEnd = useCallback(
    (_: MouseEvent | TouchEvent | null, vp: Viewport) => {
      viewportRef.current = vp
      // Ignore the programmatic fitView on mount; only persist real pans/zooms.
      if (interactedRef.current) commit()
    },
    [commit]
  )

  const toggleFilter = useCallback((key: FilterKey) => {
    setFilters((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const toggleFullscreen = useCallback(() => {
    setFullscreen((v) => !v)
    // The wrapper resizes after the state-driven re-render; re-fit once it has.
    window.setTimeout(() => rf.fitView({ padding: 0.2, duration: 200 }), 80)
  }, [rf])

  // Escape exits fullscreen (matches the built-in dialog/sheet convention).
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [fullscreen])

  // Dim entity nodes (and edges touching them) that fall outside the active
  // filter. Derived, non-persisted: `nodes`/`edges` state keeps its own styling,
  // so clearing the filter restores everything and autosave never sees opacity.
  const displayNodes = useMemo(() => {
    if (filters.size === 0) return nodes
    return nodes.map((n) =>
      n.type === "entity"
        ? { ...n, style: entityMatchesFilters(n.data.entity, filters) ? LIT_STYLE : DIMMED_STYLE }
        : n
    )
  }, [nodes, filters])

  const displayEdges = useMemo(() => {
    if (filters.size === 0) return edges
    const lit = new Set<string>()
    for (const n of nodes) {
      if (n.type !== "entity" || entityMatchesFilters(n.data.entity, filters)) lit.add(n.id)
    }
    return edges.map((e) =>
      lit.has(e.source) && lit.has(e.target)
        ? e
        : { ...e, style: { ...e.style, opacity: 0.1, transition: "opacity 150ms ease" } }
    )
  }, [edges, nodes, filters])

  const savedViewport = initialBoard?.viewport ?? undefined
  const isBusy = dirty || Boolean(saving)

  return (
    <div
      ref={wrapperRef}
      onPointerDown={() => {
        interactedRef.current = true
      }}
      className={cn(
        "relative w-full overflow-hidden border bg-muted/10",
        fullscreen ? "fixed inset-0 z-40 h-svh rounded-none" : "h-[620px] rounded-xl"
      )}
    >
      <BoardProvider value={boardActions}>
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          colorMode={colorMode}
          style={RF_THEME_VARS}
          onNodeClick={onNodeClick}
          onNodeDragStop={onNodeDragStop}
          onMoveEnd={onMoveEnd}
          onPaneClick={() => setSelected(null)}
          nodesConnectable
          connectionMode={ConnectionMode.Loose}
          deleteKeyCode={null}
          defaultViewport={savedViewport}
          fitView={!savedViewport}
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            nodeColor={miniMapNodeColor}
            className="!bg-background"
          />
          <Panel
            position="top-left"
            className="flex items-center gap-1 rounded-lg border bg-background/95 p-1 shadow-sm backdrop-blur"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => addAnnotation("text")}
            >
              <IconNote className="size-4" /> Note
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => addAnnotation("box")}
            >
              <IconSquare className="size-4" /> Box
            </Button>
            <Separator orientation="vertical" className="mx-0.5 h-5" />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={filters.size > 0 ? `Filter entities (${filters.size} active)` : "Filter entities"}
                    className={cn(filters.size > 0 && "text-primary")}
                  />
                }
              >
                <IconFilter className="size-4" /> Filter
                {filters.size > 0 && (
                  <span className="ml-0.5 rounded bg-primary/15 px-1 text-[10px] font-semibold tabular-nums text-primary">
                    {filters.size}
                  </span>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {FILTER_GROUPS.map((group, gi) => (
                  <DropdownMenuGroup key={group.label}>
                    {gi > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      {group.label}
                    </DropdownMenuLabel>
                    {group.options.map((opt) => (
                      <DropdownMenuCheckboxItem
                        key={opt.key}
                        checked={filters.has(opt.key)}
                        onCheckedChange={() => toggleFilter(opt.key)}
                      >
                        {opt.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuGroup>
                ))}
                {filters.size > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setFilters(new Set())}>
                      Clear filters
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="sm" onClick={toggleFullscreen}>
              {fullscreen ? (
                <IconMinimize className="size-4" />
              ) : (
                <IconMaximize className="size-4" />
              )}
              {fullscreen ? "Exit" : "Fullscreen"}
            </Button>
            <Separator orientation="vertical" className="mx-0.5 h-5" />
            <Button variant="ghost" size="sm" onClick={resetLayout}>
              <IconRotate className="size-4" /> Reset
            </Button>
            {onSaveBoard && (
              <>
                <Separator orientation="vertical" className="mx-0.5 h-5" />
                <span className="flex items-center gap-1 px-1.5 text-xs text-muted-foreground">
                  {isBusy ? (
                    <>
                      <IconLoader2 className="size-3 animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      <IconCheck className="size-3" /> Saved
                    </>
                  )}
                </span>
              </>
            )}
          </Panel>
        </ReactFlow>
        {selected && (
          <VesselGraphSidebar
            node={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </BoardProvider>
    </div>
  )
}

export default VesselGraphBoard
