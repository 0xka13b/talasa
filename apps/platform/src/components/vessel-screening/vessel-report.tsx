import { lazy, Suspense, useEffect, useState } from "react"
import {
  vesselBriefSchema,
  entityGraphSchema,
  graphBoardSchema,
} from "@talasa/shared"
import type {
  VesselBrief,
  VesselVerdict,
  GraphBoard,
  EntityGraph,
} from "@talasa/shared"
import { IconDownload, IconLoader2 } from "@tabler/icons-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { ReportTabsList } from "@/components/report-tabs"
import { EmptyPanel, SeverityBadge } from "./report/field"
import { formatDatesInText } from "./vessel-labels"
import { OverviewPanel } from "./report/overview-panel"
import { VesselPanel } from "./report/vessel-panel"
import { OwnershipPanel } from "./report/ownership-panel"
import { FleetPanel } from "./report/fleet-panel"
import { AisPanel } from "./report/ais-panel"
import { useSaveGraphBoard } from "@/hooks/use-screenings"

// The interactive graph board (React Flow) is client-only and heavy, so it's
// code-split and only pulled in when the user opens the Graph view.
const VesselGraphBoard = lazy(() => import("./flow/graph-board"))

const REPORT_TABS = [
  { value: "overview", label: "Overview" },
  { value: "vessel", label: "Vessel" },
  { value: "ownership", label: "Ownership" },
  { value: "fleet", label: "Sister fleet" },
  { value: "ais", label: "AIS behaviour" },
  { value: "relationships", label: "Graph" },
] as const

export function VesselReport({
  brief,
  graph,
  screeningId,
  graphBoard,
}: {
  brief: unknown
  graph: unknown
  screeningId?: string
  graphBoard?: unknown
}) {
  const [tab, setTab] = useState<string>("overview")
  const parsed = vesselBriefSchema.safeParse(brief)
  if (!parsed.success) {
    return (
      <Card className="mx-auto w-full max-w-[700px]">
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground">
            Report unavailable — this screening could not be displayed.
          </p>
        </CardContent>
      </Card>
    )
  }
  const b: VesselBrief = parsed.data

  return (
    <div className="mx-auto flex w-full max-w-[700px] flex-col gap-6">
      <Tabs value={tab} onValueChange={setTab}>
        <ReportTabsList tabs={REPORT_TABS} value={tab} onValueChange={setTab} />
        <TabsContent value="overview" className="pt-5">
          <div className="flex flex-col gap-6">
            <VerdictHero b={b} />
            <OverviewPanel b={b} />
          </div>
        </TabsContent>
        <TabsContent value="vessel" className="pt-5">
          <VesselPanel b={b} />
        </TabsContent>
        <TabsContent value="ownership" className="pt-5">
          <OwnershipPanel b={b} />
        </TabsContent>
        <TabsContent value="fleet" className="pt-5">
          <FleetPanel b={b} />
        </TabsContent>
        <TabsContent value="ais" className="pt-5">
          <AisPanel b={b} />
        </TabsContent>
        <TabsContent value="relationships" className="pt-5">
          <GraphView
            graph={graph}
            screeningId={screeningId}
            graphBoard={graphBoard}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/**
 * Exports the report as a client-facing PDF. The `@react-pdf/renderer` runtime
 * and the document tree are pulled in lazily on click so they never weigh down
 * the main bundle.
 */
export function ExportPdfButton({
  brief,
  graph,
}: {
  brief: unknown
  graph: unknown
}) {
  const [busy, setBusy] = useState(false)
  // Parse here so the button can be rendered straight from a raw screening row
  // (e.g. the page header) without the caller validating the brief first.
  const parsed = vesselBriefSchema.safeParse(brief)
  if (!parsed.success) return null
  const data = parsed.data
  async function handleExport() {
    setBusy(true)
    try {
      const { exportBriefPdf } = await import("./pdf")
      await exportBriefPdf(data, graph)
    } catch (err) {
      console.error("PDF export failed", err)
      toast.error("Couldn't generate the PDF. Please try again.")
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button variant="outline" onClick={handleExport} disabled={busy}>
      {busy ? <IconLoader2 className="animate-spin" /> : <IconDownload />}
      {busy ? "Generating…" : "PDF"}
    </Button>
  )
}

// Verdict-driven tints — a subtle wash + accent bar keyed to the decision, so
// the hero reads as red / amber / green at a glance in both themes.
const HERO_TINT: Record<VesselVerdict, string> = {
  PROCEED: "border-emerald-500/25 bg-emerald-500/[0.04]",
  CAUTION: "border-amber-500/25 bg-amber-500/[0.04]",
  BLOCK: "border-red-500/25 bg-red-500/[0.05]",
}
const HERO_ACCENT: Record<VesselVerdict, string> = {
  PROCEED: "bg-emerald-500",
  CAUTION: "bg-amber-500",
  BLOCK: "bg-red-500",
}
const SCORE_TINT: Record<VesselVerdict, string> = {
  PROCEED: "text-emerald-600 dark:text-emerald-400",
  CAUTION: "text-amber-600 dark:text-amber-400",
  BLOCK: "text-red-600 dark:text-red-400",
}
const SCORE_RING: Record<VesselVerdict, string> = {
  PROCEED: "stroke-emerald-500",
  CAUTION: "stroke-amber-500",
  BLOCK: "stroke-red-500",
}
// SVG donut trick: r = 15.9155 makes the circle's circumference ≈ 100, so a
// dasharray of "score, 100-score" maps 1:1 to a 0-100 score without any math.
const RING_RADIUS = 15.9155

/**
 * The headline block: verdict, recommendation, risk score, identity, and the
 * risk signals — everything the analyst needs before drilling into the tabs.
 */
// Order risk signals by how much they matter: blocking, then strong, then weak.
const SEVERITY_RANK: Record<string, number> = {
  blocking: 0,
  strong: 1,
  weak: 2,
}

function VerdictHero({ b }: { b: VesselBrief }) {
  const v = b.verdict.decision
  const pct = Math.max(0, Math.min(100, b.verdict.score))
  const [showReview, setShowReview] = useState(false)
  const signals = [...b.signals].sort(
    (a, z) =>
      (SEVERITY_RANK[a.severity] ?? 99) - (SEVERITY_RANK[z.severity] ?? 99)
  )
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-xl border p-5 pl-6",
        HERO_TINT[v]
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", HERO_ACCENT[v])} />

      <div className="flex flex-wrap items-center gap-y-2">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 36 36" className="size-5 -rotate-90" aria-hidden="true">
            <circle
              cx="18"
              cy="18"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="6"
              className="stroke-muted"
            />
            <circle
              cx="18"
              cy="18"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${pct} ${100 - pct}`}
              className={SCORE_RING[v]}
            />
          </svg>
          <span className={cn("text-sm font-semibold tabular-nums", SCORE_TINT[v])}>
            {b.verdict.score}
            <span className="font-normal text-primary">/100</span>
          </span>
        </div>

        <span className={cn("pl-10 text-sm font-semibold", SCORE_TINT[v])}>
          <span className="font-normal text-primary">Recommendation: </span>
          {v}
        </span>

        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => setShowReview((s) => !s)}
        >
          {showReview ? "Hide review" : "Show review"}
        </Button>
      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
          showReview ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <p className="mt-2.5 border-t pt-2.5 text-[14px] leading-[1.4]">
            {formatDatesInText(b.recommendation)}
          </p>
        </div>
      </div>

      {signals.length > 0 && (
        <div className="mt-4 border-t pt-4">
          <h3 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Risk signals
          </h3>
          <ul className="flex flex-col gap-2.5">
            {signals.map((s, i) => (
              <li key={`${s.kind}-${i}`} className="flex items-start gap-3">
                <SeverityBadge severity={s.severity} />
                <span className="text-sm leading-relaxed">{s.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function GraphView({
  graph,
  screeningId,
  graphBoard,
}: {
  graph: unknown
  screeningId?: string
  graphBoard?: unknown
}) {
  // React Flow touches the DOM, so it must not render during SSR — gate the
  // Graph view behind a post-hydration mount flag.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const parsed = entityGraphSchema.safeParse(graph)
  if (!parsed.success || parsed.data.nodes.length === 0) {
    return <EmptyPanel>No graph available.</EmptyPanel>
  }

  const parsedBoard = graphBoardSchema.safeParse(graphBoard)
  const board: GraphBoard | null = parsedBoard.success ? parsedBoard.data : null

  if (!mounted) return <GraphSkeleton />

  return (
    <Suspense fallback={<GraphSkeleton />}>
      {screeningId ? (
        <SavingGraphBoard
          screeningId={screeningId}
          graph={parsed.data}
          board={board}
        />
      ) : (
        <VesselGraphBoard graph={parsed.data} initialBoard={board} />
      )}
    </Suspense>
  )
}

/**
 * Wraps the board with the save mutation. Isolated so the save hook (which needs
 * a QueryClient) only runs when the Graph view is actually open with a persisted
 * screening — the List view and hook-less renders never touch react-query.
 */
function SavingGraphBoard({
  screeningId,
  graph,
  board,
}: {
  screeningId: string
  graph: EntityGraph
  board: GraphBoard | null
}) {
  const save = useSaveGraphBoard(screeningId)
  return (
    <VesselGraphBoard
      graph={graph}
      initialBoard={board}
      onSaveBoard={(b) => save.mutate(b)}
      saving={save.isPending}
    />
  )
}

function GraphSkeleton() {
  return (
    <div className="flex h-[620px] w-full items-center justify-center rounded-xl border text-sm text-muted-foreground">
      Loading graph…
    </div>
  )
}
