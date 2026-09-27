import { Link } from "@tanstack/react-router"
import { IconRadar2, IconShip, IconStack2 } from "@tabler/icons-react"
import { CHECK_LABELS, type MonitorSummary } from "@talasa/shared"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { CARD_CLASS } from "../vessel-screening-card"

type Tone = "muted" | "ok" | "warn"

const TONE_BADGE: Record<Tone, string> = {
  muted: "bg-muted text-muted-foreground",
  ok: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  warn: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
}

/** Short summary of the checks a monitor re-runs, e.g. "Sanctions +1". */
export function checksLabel(checks: MonitorSummary["checks"]): string {
  if (checks.length === 0) return "—"
  const first = CHECK_LABELS[checks[0]!]
  return checks.length === 1 ? first : `${first} +${checks.length - 1}`
}

function status(m: MonitorSummary): { label: string; tone: Tone } {
  if (!m.enabled) return { label: "Paused", tone: "muted" }
  if (m.unacknowledgedChanges > 0) {
    return { label: `${m.unacknowledgedChanges} change${m.unacknowledgedChanges === 1 ? "" : "s"}`, tone: "warn" }
  }
  return { label: "Active", tone: "ok" }
}

/** Sidebar card for a monitor — a "Monitor" tag, the target + cadence, and either
 * an unacknowledged-changes count (amber) or an Active/Paused pill. */
export function MonitorListCard({ monitor, onNavigate }: { monitor: MonitorSummary; onNavigate?: () => void }) {
  const s = status(monitor)
  const target = monitor.targetKind === "batch" ? `${monitor.vesselCount} vessels` : `IMO ${monitor.imo}`

  return (
    <Link
      to="/vessel-screening/monitoring/$monitorId"
      params={{ monitorId: monitor.id }}
      activeProps={{ "data-active": true }}
      onClick={onNavigate}
      className={CARD_CLASS}
    >
      <div className="flex items-center justify-between gap-2">
        <Badge variant="secondary" className="gap-1 text-[10px] uppercase">
          <IconRadar2 className="size-3" />
          Monitor
        </Badge>
        <Badge className={cn("shrink-0", TONE_BADGE[s.tone])}>{s.label}</Badge>
      </div>

      <p className="truncate text-sm font-medium">{monitor.name}</p>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {monitor.targetKind === "batch" ? <IconStack2 className="size-3" /> : <IconShip className="size-3" />}
        <span className="truncate">{target}</span>
        <span aria-hidden>·</span>
        <span className="capitalize">{monitor.cadence}</span>
        <span aria-hidden>·</span>
        <span className="truncate">{checksLabel(monitor.checks)}</span>
      </p>
    </Link>
  )
}
