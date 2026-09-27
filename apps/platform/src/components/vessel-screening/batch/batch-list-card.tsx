import { Link } from "@tanstack/react-router"
import { IconStack2 } from "@tabler/icons-react"
import type { BatchStatusCounts, BatchSummary } from "@talasa/shared"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { CARD_CLASS } from "../vessel-screening-card"

type Tone = "running" | "ok" | "warn" | "danger"

const TONE_BADGE: Record<Tone, string> = {
  running: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  ok: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  warn: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  danger: "bg-red-500/15 text-red-600 dark:text-red-400",
}

const TONE_BAR: Record<Tone, string> = {
  running: "bg-blue-500",
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  danger: "bg-red-500",
}

/**
 * Roll a batch's member counts into a single overall status. While any member is
 * queued/running the batch is in flight; once every member has settled it's
 * Completed — but we call out partial failure ("Completed · N failed") and total
 * failure distinctly, since a broker needs to know the set isn't fully clean.
 */
function overallStatus(c: BatchStatusCounts): { label: string; tone: Tone } {
  if (c.running > 0) return { label: "Running", tone: "running" }
  if (c.queued > 0) return { label: "Queued", tone: "running" }
  if (c.failed > 0 && c.completed === 0) return { label: "All failed", tone: "danger" }
  if (c.failed > 0) return { label: `Completed · ${c.failed} failed`, tone: "warn" }
  return { label: "Completed", tone: "ok" }
}

/** Sidebar card for a batch — distinct from a single screening: a "Batch" tag,
 * the vessel count, and one overall-status pill + progress bar. */
export function BatchListCard({ batch, onNavigate }: { batch: BatchSummary; onNavigate?: () => void }) {
  const c = batch.counts
  const done = c.completed + c.failed
  const pct = c.total > 0 ? Math.round((done / c.total) * 100) : 0
  const status = overallStatus(c)
  const inFlight = c.queued + c.running > 0

  return (
    <Link
      to="/vessel-screening/batch/$batchId"
      params={{ batchId: batch.id }}
      activeProps={{ "data-active": true }}
      onClick={onNavigate}
      className={CARD_CLASS}
    >
      <div className="flex items-center justify-between gap-2">
        <Badge variant="secondary" className="gap-1 text-[10px] uppercase">
          <IconStack2 className="size-3" />
          Batch
        </Badge>
        <Badge className={cn("shrink-0", TONE_BADGE[status.tone])}>{status.label}</Badge>
      </div>

      <p className="truncate text-sm font-medium">{batch.name}</p>

      <p className="text-xs text-muted-foreground">
        {c.total} vessel{c.total === 1 ? "" : "s"}
        {inFlight
          ? ` · ${done} of ${c.total} screened`
          : c.failed > 0
            ? ` · ${c.completed} completed · ${c.failed} failed`
            : ""}
      </p>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", TONE_BAR[status.tone])}
          style={{ width: `${inFlight ? pct : 100}%` }}
        />
      </div>
    </Link>
  )
}
