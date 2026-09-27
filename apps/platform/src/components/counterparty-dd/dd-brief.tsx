import { lazy, Suspense, useEffect, useState } from "react"
import { briefSchema } from "@talasa/shared"
import type { Brief, RiskBand, EntityGraph } from "@talasa/shared"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { ReportTabsList } from "@/components/report-tabs"
import { cn } from "@/lib/utils"
import {
  formatDatesInText,
  formatDriver,
} from "@/components/vessel-screening/vessel-labels"
import { DDOverviewPanel } from "./report/dd-overview-panel"
import { DDFleetPanel } from "./report/dd-fleet-panel"
import { DDNetworkPanel } from "./report/dd-network-panel"
import { DDOwnershipPanel } from "./report/dd-ownership-panel"

// The interactive relationship graph (React Flow) is client-only and heavy, so
// it's code-split and only pulled in once the Graph view is opened. Reused from
// the vessel screening board — one graph vocabulary across both products.
const CompanyGraphBoard = lazy(
  () => import("../vessel-screening/flow/graph-board")
)

const DD_REPORT_TABS = [
  { value: "overview", label: "Overview" },
  { value: "fleet", label: "Fleet" },
  { value: "network", label: "Network" },
  { value: "ownership", label: "Ownership" },
  { value: "relationships", label: "Graph" },
] as const

export function DDBrief({ brief }: { brief: unknown }) {
  const [tab, setTab] = useState<string>("overview")
  const parsed = briefSchema.safeParse(brief)
  if (!parsed.success) {
    return (
      <Card className="mx-auto w-full max-w-[700px]">
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground">
            Brief unavailable — this report could not be displayed.
          </p>
        </CardContent>
      </Card>
    )
  }
  const b: Brief = parsed.data

  return (
    <div className="mx-auto flex w-full max-w-[700px] flex-col gap-6">
      <Tabs value={tab} onValueChange={setTab}>
        <ReportTabsList tabs={DD_REPORT_TABS} value={tab} onValueChange={setTab} />
        <TabsContent value="overview" className="pt-5">
          <div className="flex flex-col gap-6">
            <RiskHero b={b} />
            <DDOverviewPanel b={b} />
          </div>
        </TabsContent>
        <TabsContent value="fleet" className="pt-5">
          <DDFleetPanel b={b} />
        </TabsContent>
        <TabsContent value="network" className="pt-5">
          <DDNetworkPanel b={b} />
        </TabsContent>
        <TabsContent value="ownership" className="pt-5">
          <DDOwnershipPanel b={b} />
        </TabsContent>
        <TabsContent value="relationships" className="pt-5">
          <GraphView graph={b.graph} narrative={b.affiliations.narrative} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Band-driven tints — a subtle wash + accent bar keyed to the decision, so the
// hero reads red / amber / green at a glance in both themes.
const HERO_TINT: Record<RiskBand, string> = {
  CLEAR: "border-emerald-500/25 bg-emerald-500/[0.04]",
  ENHANCED_DD: "border-amber-500/25 bg-amber-500/[0.04]",
  REJECT: "border-red-500/25 bg-red-500/[0.05]",
}
const HERO_ACCENT: Record<RiskBand, string> = {
  CLEAR: "bg-emerald-500",
  ENHANCED_DD: "bg-amber-500",
  REJECT: "bg-red-500",
}
const SCORE_TINT: Record<RiskBand, string> = {
  CLEAR: "text-emerald-600 dark:text-emerald-400",
  ENHANCED_DD: "text-amber-600 dark:text-amber-400",
  REJECT: "text-red-600 dark:text-red-400",
}
const SCORE_RING: Record<RiskBand, string> = {
  CLEAR: "stroke-emerald-500",
  ENHANCED_DD: "stroke-amber-500",
  REJECT: "stroke-red-500",
}
const BAND_LABEL: Record<RiskBand, string> = {
  CLEAR: "CLEAR",
  ENHANCED_DD: "ENHANCED DD",
  REJECT: "REJECT",
}
// SVG donut trick: r = 15.9155 makes the circle's circumference ≈ 100, so a
// dasharray of "score, 100-score" maps 1:1 to a 0-100 score without any math.
const RING_RADIUS = 15.9155

/**
 * The headline block: risk band, recommended action, score, and the risk
 * drivers — everything the analyst needs before drilling into the tabs. Mirrors
 * the vessel report's verdict hero for a consistent read across both products.
 */
function RiskHero({ b }: { b: Brief }) {
  const band = b.riskScore.band
  const pct = Math.max(0, Math.min(100, b.riskScore.value))
  const [showReview, setShowReview] = useState(false)
  const drivers = b.riskScore.drivers
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-xl border p-5 pl-6",
        HERO_TINT[band]
      )}
    >
      <span
        className={cn("absolute inset-y-0 left-0 w-1", HERO_ACCENT[band])}
      />

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
              className={SCORE_RING[band]}
            />
          </svg>
          <span className={cn("text-sm font-semibold tabular-nums", SCORE_TINT[band])}>
            {b.riskScore.value}
            <span className="font-normal text-primary">/100</span>
          </span>
        </div>

        <span className={cn("pl-10 text-sm font-semibold", SCORE_TINT[band])}>
          <span className="font-normal text-primary">Recommendation: </span>
          {BAND_LABEL[band]}
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
            {formatDatesInText(b.recommendedAction.rationale)}
          </p>
        </div>
      </div>

      {(drivers.length > 0 || b.riskScore.justification) && (
        <div className="mt-4 border-t pt-4">
          <h3 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Risk drivers
          </h3>
          {drivers.length > 0 && (
            <ul className="mb-3 flex flex-wrap gap-1.5">
              {drivers.map((d, i) => (
                <Badge key={`${d}-${i}`} variant="secondary">
                  {formatDriver(d)}
                </Badge>
              ))}
            </ul>
          )}
          {b.riskScore.justification && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {formatDatesInText(b.riskScore.justification)}
            </p>
          )}
        </div>
      )}
    </section>
  )
}

/**
 * The relationship network on the shared interactive board (React Flow), gated
 * behind a post-hydration mount flag + Suspense fallback (mirrors the vessel
 * report's GraphView) since React Flow touches the DOM and must not render
 * during SSR.
 */
function GraphView({
  graph,
  narrative,
}: {
  graph?: EntityGraph | null
  narrative?: string
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!graph || graph.nodes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No relationship network available.
      </p>
    )
  }

  if (!mounted) return <GraphSkeleton />

  return (
    <div className="flex flex-col gap-3">
      <Suspense fallback={<GraphSkeleton />}>
        <CompanyGraphBoard graph={graph} initialBoard={null} />
      </Suspense>
      {narrative && (
        <p className="text-sm text-muted-foreground">
          {formatDatesInText(narrative)}
        </p>
      )}
    </div>
  )
}

function GraphSkeleton() {
  return (
    <div className="flex h-[620px] w-full items-center justify-center rounded-xl border text-sm text-muted-foreground">
      Loading network…
    </div>
  )
}
