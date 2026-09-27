import { Link } from "@tanstack/react-router"
import { briefSchema } from "@talasa/shared"
import type { Project } from "@talasa/shared"
import { ProjectStatusBadge } from "@/components/projects/project-status-badge"
import { highlightMatches } from "@/lib/highlight-match"
import { DDVerdictBadge } from "./dd-verdict-badge"

export function verdictOf(p: Project) {
  if (p.status !== "completed") return null
  const parsed = briefSchema.safeParse(p.brief)
  return parsed.success ? parsed.data.riskScore.band : null
}

/**
 * When a project finished. We use the latest stage finish time rather than
 * `updatedAt` — a later edit would bump `updatedAt` and misreport completion.
 * Falls back to `updatedAt` for older rows with no stage timing.
 */
export function completedAt(p: Project): string | null {
  if (p.status !== "completed") return null
  const finishes = Object.values(p.steps ?? {})
    .map((st) => st.finishedAt)
    .filter((t): t is string => Boolean(t))
  if (finishes.length > 0) return finishes.reduce((a, b) => (a > b ? a : b))
  return p.updatedAt
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

const CARD_CLASS =
  "group flex cursor-pointer flex-col gap-2 rounded-lg border bg-card p-3 text-left transition duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] hover:-translate-y-0.5 hover:scale-[1.01] hover:border-primary/50 hover:bg-accent/60 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none data-active:border-primary data-active:bg-accent/60 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100"

export function ProjectCard({
  project,
  query = "",
  onNavigate,
}: {
  project: Project
  query?: string
  onNavigate?: () => void
}) {
  const band = verdictOf(project)
  return (
    <Link
      to="/counterparty-dd/$projectId"
      params={{ projectId: project.id }}
      activeProps={{ "data-active": true }}
      onClick={onNavigate}
      className={CARD_CLASS}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {highlightMatches(project.name, query)}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {highlightMatches(project.counterpartyName, query)}
          </p>
        </div>
        {band ? (
          <DDVerdictBadge band={band} />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <span className="flex min-w-0 shrink items-center gap-1 truncate">
          {project.country ? highlightMatches(project.country, query) : "—"}
        </span>
        {project.companyImo && (
          <>
            <span aria-hidden className="shrink-0">
              •
            </span>
            <span className="shrink-0 tabular-nums">
              IMO {highlightMatches(project.companyImo, query)}
            </span>
          </>
        )}
      </div>

      <ProjectStatusBadge
        status={project.status}
        label={
          project.status === "completed"
            ? `Completed ${formatDateTime(completedAt(project))}`
            : undefined
        }
      />
    </Link>
  )
}
