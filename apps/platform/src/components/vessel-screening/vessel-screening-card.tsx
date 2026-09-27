import { Link } from "@tanstack/react-router"
import { vesselBriefSchema, type Screening } from "@talasa/shared"
import { ProjectStatusBadge } from "@/components/projects/project-status-badge"
import { CountryFlag } from "@/lib/country-flag"
import { highlightMatches } from "@/lib/highlight-match"
import { VesselVerdictBadge } from "./vessel-verdict-badge"

export function verdictOf(s: Screening) {
  if (s.status !== "completed") return null
  const parsed = vesselBriefSchema.safeParse(s.brief)
  return parsed.success ? parsed.data.verdict.decision : null
}

/**
 * When a screening finished. We use the latest stage finish time rather than
 * `updatedAt` — a later graph-board save would bump `updatedAt` and misreport
 * completion. Falls back to `updatedAt` for older rows with no stage timing.
 */
export function completedAt(s: Screening): string | null {
  if (s.status !== "completed") return null
  const finishes = Object.values(s.steps ?? {})
    .map((st) => st.finishedAt)
    .filter((t): t is string => Boolean(t))
  if (finishes.length > 0) return finishes.reduce((a, b) => (a > b ? a : b))
  return s.updatedAt
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export const CARD_CLASS =
  "group flex cursor-pointer flex-col gap-2 rounded-lg border bg-card p-3 text-left transition duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] hover:-translate-y-0.5 hover:scale-[1.01] hover:border-primary/50 hover:bg-accent/60 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none data-active:border-primary data-active:bg-accent/60 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100"

export function ScreeningCard({
  screening,
  query = "",
  onNavigate,
}: {
  screening: Screening
  query?: string
  onNavigate?: () => void
}) {
  const verdict = verdictOf(screening)
  return (
    <Link
      to="/vessel-screening/$screeningId"
      params={{ screeningId: screening.id }}
      activeProps={{ "data-active": true }}
      onClick={onNavigate}
      className={CARD_CLASS}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{highlightMatches(screening.name, query)}</p>
          {screening.vesselName && (
            <p className="truncate text-xs text-muted-foreground">
              {highlightMatches(screening.vesselName, query)}
            </p>
          )}
        </div>
        {verdict ? (
          <VesselVerdictBadge verdict={verdict} />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <span className="flex min-w-0 shrink items-center gap-1 truncate">
          {screening.flag ? (
            <>
              <CountryFlag country={screening.flag} />
              {highlightMatches(screening.flag, query)}
            </>
          ) : (
            "—"
          )}
        </span>
        <span aria-hidden className="shrink-0">
          •
        </span>
        <span className="shrink-0 tabular-nums">IMO {highlightMatches(screening.imo, query)}</span>
      </div>

      <ProjectStatusBadge
        status={screening.status}
        label={screening.status === "completed" ? `Completed ${formatDateTime(completedAt(screening))}` : undefined}
      />
    </Link>
  )
}
