import { Link } from "@tanstack/react-router"
import { IconBuilding, IconShip } from "@tabler/icons-react"
import { briefSchema, vesselBriefSchema } from "@talasa/shared"
import type { Project, ProjectStatus, Screening } from "@talasa/shared"
import { Badge } from "@/components/ui/badge"
import { ProjectStatusBadge } from "@/components/projects/project-status-badge"
import { cn } from "@/lib/utils"

type Kind = "vessel" | "counterparty"
type Tone = "positive" | "warn" | "danger"

interface RecentItem {
  id: string
  kind: Kind
  name: string
  subject: string
  imo: string | null
  status: ProjectStatus
  verdict: { label: string; tone: Tone } | null
  when: string
}

const VESSEL_TONE: Record<string, Tone> = {
  PROCEED: "positive",
  CAUTION: "warn",
  BLOCK: "danger",
}
const BAND_TONE: Record<string, Tone> = {
  CLEAR: "positive",
  ENHANCED_DD: "warn",
  REJECT: "danger",
}
const TONE_BADGE: Record<Tone, string> = {
  positive: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  warn: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  danger: "bg-red-500/15 text-red-600 dark:text-red-400",
}
const TONE_ACCENT: Record<Tone, string> = {
  positive: "bg-emerald-500",
  warn: "bg-amber-500",
  danger: "bg-red-500",
}

const KIND_META: Record<
  Kind,
  { label: string; Icon: typeof IconShip; chip: string }
> = {
  vessel: {
    label: "Screening",
    Icon: IconShip,
    chip: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  },
  counterparty: {
    label: "Counterparty DD",
    Icon: IconBuilding,
    chip: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
}

/** Latest stage-finish time (stable across later graph-board saves), else updatedAt. */
function settledAt(row: {
  status: ProjectStatus
  steps?: Record<string, { finishedAt?: string | null }> | null
  updatedAt: string
}): string | null {
  if (row.status !== "completed") return null
  const finishes = Object.values(row.steps ?? {})
    .map((st) => st.finishedAt)
    .filter((t): t is string => Boolean(t))
  if (finishes.length > 0) return finishes.reduce((a, b) => (a > b ? a : b))
  return row.updatedAt
}

function screeningItem(s: Screening): RecentItem {
  const parsed =
    s.status === "completed" ? vesselBriefSchema.safeParse(s.brief) : null
  const decision = parsed?.success ? parsed.data.verdict.decision : null
  return {
    id: s.id,
    kind: "vessel",
    name: s.name,
    subject: s.vesselName ?? "Unnamed vessel",
    imo: s.imo,
    status: s.status,
    verdict: decision
      ? { label: decision, tone: VESSEL_TONE[decision] ?? "warn" }
      : null,
    when: settledAt(s) ?? s.createdAt,
  }
}

function projectItem(p: Project): RecentItem {
  const parsed =
    p.status === "completed" ? briefSchema.safeParse(p.brief) : null
  const band = parsed?.success ? parsed.data.riskScore.band : null
  return {
    id: p.id,
    kind: "counterparty",
    name: p.name,
    subject: p.counterpartyName,
    imo: p.companyImo,
    status: p.status,
    verdict: band ? { label: band, tone: BAND_TONE[band] ?? "warn" } : null,
    when: settledAt(p) ?? p.createdAt,
  }
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/** The N most-recent runs across both products, newest first. */
export function recentItems(
  screenings: Screening[],
  projects: Project[],
  limit = 5
): RecentItem[] {
  return [...screenings.map(screeningItem), ...projects.map(projectItem)]
    .sort((a, b) => b.when.localeCompare(a.when))
    .slice(0, limit)
}

export function RecentProjects({
  screenings,
  projects,
}: {
  screenings: Screening[]
  projects: Project[]
}) {
  const items = recentItems(screenings, projects, 3)
  if (items.length === 0) return null
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        Recent activity
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <RecentCard key={`${item.kind}-${item.id}`} item={item} />
        ))}
      </div>
    </section>
  )
}

const CARD_CLASS =
  "group relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-card p-4 pl-5 transition duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] hover:-translate-y-0.5 hover:scale-[1.015] hover:border-primary/50 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100"

function RecentCard({ item }: { item: RecentItem }) {
  const { label: kindLabel, Icon, chip } = KIND_META[item.kind]
  const accent = item.verdict ? TONE_ACCENT[item.verdict.tone] : "bg-border"

  const inner = (
    <>
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-1", accent)}
      />

      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-md",
              chip
            )}
          >
            <Icon className="size-4" />
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {kindLabel}
          </span>
        </span>
        <ProjectStatusBadge status={item.status} />
      </div>

      <div className="min-w-0">
        <p className="truncate font-medium">{item.name}</p>
        <p className="truncate text-xs text-muted-foreground">{item.subject}</p>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate text-muted-foreground tabular-nums">
          {item.imo ? `IMO ${item.imo}` : formatWhen(item.when)}
        </span>
        {item.verdict && (
          <Badge
            className={cn(
              "font-semibold tracking-wide",
              TONE_BADGE[item.verdict.tone]
            )}
          >
            {item.verdict.label}
          </Badge>
        )}
      </div>
    </>
  )

  if (item.kind === "vessel") {
    return (
      <Link
        to="/vessel-screening/$screeningId"
        params={{ screeningId: item.id }}
        className={CARD_CLASS}
      >
        {inner}
      </Link>
    )
  }
  return (
    <Link
      to="/counterparty-dd/$projectId"
      params={{ projectId: item.id }}
      className={CARD_CLASS}
    >
      {inner}
    </Link>
  )
}
