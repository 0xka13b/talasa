import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"
import { Link, useNavigate, useParams } from "@tanstack/react-router"
import {
  IconChevronDown,
  IconChevronUp,
  IconFilter,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconPlus,
  IconRadar2,
  IconSearch,
  IconShip,
  IconUpload,
  IconX,
} from "@tabler/icons-react"
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  VESSEL_VERDICTS,
  type ProjectStatus,
  type Screening,
  type VesselVerdict,
} from "@talasa/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useScreenings } from "@/hooks/use-screenings"
import { useBatches } from "@/hooks/use-batches"
import { useMonitors } from "@/hooks/use-monitors"
import { cn } from "@/lib/utils"
import { ScreeningCard, completedAt, verdictOf } from "./vessel-screening-card"
import { BatchListCard } from "./batch/batch-list-card"
import { MonitorListCard } from "./monitoring/monitor-list-card"

interface Filters {
  statuses: Set<ProjectStatus>
  verdicts: Set<VesselVerdict>
}

/**
 * Collapsed state lives here, above the chat panel's open/closed split, so it
 * survives that split's tree swap (opening/closing chat remounts everything
 * under `AppShellBody`, which would otherwise reset a local `useState`).
 */
const SidebarCollapsedContext = createContext<[boolean, Dispatch<SetStateAction<boolean>>] | null>(null)

export function VesselScreeningSidebarProvider({ children }: { children: ReactNode }) {
  const state = useState(false)
  return <SidebarCollapsedContext.Provider value={state}>{children}</SidebarCollapsedContext.Provider>
}

function useSidebarCollapsed() {
  const ctx = useContext(SidebarCollapsedContext)
  if (!ctx) throw new Error("useSidebarCollapsed must be used within a VesselScreeningSidebarProvider")
  return ctx
}

const EMPTY_FILTERS: Filters = { statuses: new Set(), verdicts: new Set() }

function useFilteredScreenings(screenings: Screening[], query: string, filters: Filters) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return screenings.filter((s) => {
      if (filters.statuses.size > 0 && !filters.statuses.has(s.status)) return false
      if (filters.verdicts.size > 0) {
        const verdict = verdictOf(s)
        if (!verdict || !filters.verdicts.has(verdict)) return false
      }
      if (!q) return true
      return [s.name, s.vesselName ?? "", s.imo, s.flag ?? ""].some((f) =>
        f.toLowerCase().includes(q)
      )
    })
  }, [screenings, query, filters])

  return useMemo(
    () =>
      [...filtered].sort((a, b) =>
        (completedAt(b) ?? b.createdAt).localeCompare(completedAt(a) ?? a.createdAt)
      ),
    [filtered]
  )
}

function FilterMenu({ filters, onChange }: { filters: Filters; onChange: (next: Filters) => void }) {
  const activeCount = filters.statuses.size + filters.verdicts.size

  function toggleStatus(status: ProjectStatus) {
    const next = new Set(filters.statuses)
    next.has(status) ? next.delete(status) : next.add(status)
    onChange({ ...filters, statuses: next })
  }

  function toggleVerdict(verdict: VesselVerdict) {
    const next = new Set(filters.verdicts)
    next.has(verdict) ? next.delete(verdict) : next.add(verdict)
    onChange({ ...filters, verdicts: next })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            aria-label={activeCount > 0 ? `Filter screenings (${activeCount} active)` : "Filter screenings"}
            className="relative shrink-0"
          />
        }
      >
        <IconFilter className="size-4" />
        {activeCount > 0 && (
          <Badge className="absolute -top-1.5 -right-1.5 h-4 min-w-4 justify-center px-1 text-[10px] tabular-nums">
            {activeCount}
          </Badge>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Status</DropdownMenuLabel>
          {PROJECT_STATUSES.map((status) => (
            <DropdownMenuCheckboxItem
              key={status}
              checked={filters.statuses.has(status)}
              onCheckedChange={() => toggleStatus(status)}
            >
              {PROJECT_STATUS_LABELS[status]}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Verdict</DropdownMenuLabel>
          {VESSEL_VERDICTS.map((verdict) => (
            <DropdownMenuCheckboxItem
              key={verdict}
              checked={filters.verdicts.has(verdict)}
              onCheckedChange={() => toggleVerdict(verdict)}
            >
              {verdict}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
        {activeCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onChange(EMPTY_FILTERS)}>Clear filters</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-lg border bg-muted/40" />
      ))}
    </div>
  )
}

/**
 * A titled, expand/collapse group in the screenings list. Defaults to open; the
 * count sits next to the title and the chevron rotates with the open state.
 */
function CollapsibleSection({
  title,
  count,
  defaultOpen = true,
  children,
}: {
  title: string
  count: number
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col gap-2">
      <CollapsibleTrigger className="flex items-center gap-1 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground">
        <IconChevronDown
          className={cn("size-3.5 shrink-0 transition-transform", !open && "-rotate-90")}
        />
        <span>{title}</span>
        <span className="text-muted-foreground/60 tabular-nums">({count})</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-2">{children}</CollapsibleContent>
    </Collapsible>
  )
}

function SidebarBody({
  onNavigate,
  collapseButton,
}: {
  onNavigate?: () => void
  collapseButton?: ReactNode
}) {
  const { data, isPending } = useScreenings()
  const { data: batchData } = useBatches()
  const { data: monitorData } = useMonitors()
  // Batch members + monitor runs live under their batch/monitor, not in the flat
  // list — so an uploaded set or a monitor's recurring runs don't flood it.
  const screenings = (data ?? []).filter((s) => !s.batchId && !s.monitorId)
  const [query, setQuery] = useState("")
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const sorted = useFilteredScreenings(screenings, query, filters)
  const isFiltered = query.trim().length > 0 || filters.statuses.size > 0 || filters.verdicts.size > 0
  const q = query.trim().toLowerCase()
  const batches = (batchData ?? []).filter((b) => !q || b.name.toLowerCase().includes(q))
  const monitors = (monitorData ?? []).filter((m) => !q || m.name.toLowerCase().includes(q))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-2 border-b p-3">
        <div className="flex items-center gap-2">
          {collapseButton}
          <Link to="/vessel-screening/new" onClick={onNavigate} className="min-w-0 flex-1">
            <Button className="w-full gap-1.5">
              <IconPlus className="size-4" />
              New screening
            </Button>
          </Link>
          <Link to="/vessel-screening/batch" onClick={onNavigate}>
            <Button variant="outline" size="icon" aria-label="Upload a batch of vessels">
              <IconUpload className="size-4" />
            </Button>
          </Link>
          <Link to="/vessel-screening/monitoring" onClick={onNavigate}>
            <Button variant="outline" size="icon" aria-label="Create a recurring monitor">
              <IconRadar2 className="size-4" />
            </Button>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, IMO or flag"
              className={query ? "pl-8 pr-8" : "pl-8"}
              aria-label="Search screenings"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <IconX className="size-4" />
              </button>
            )}
          </div>
          <FilterMenu filters={filters} onChange={setFilters} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {isPending ? (
          <SidebarSkeleton />
        ) : screenings.length === 0 && (batchData ?? []).length === 0 && (monitorData ?? []).length === 0 ? (
          <p className="px-1 py-8 text-center text-sm text-muted-foreground">
            No screenings yet. Start one above.
          </p>
        ) : sorted.length === 0 && batches.length === 0 && monitors.length === 0 ? (
          <p className="px-1 py-8 text-center text-sm text-muted-foreground">
            {isFiltered ? "Nothing matches your search or filters." : "No screenings yet."}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {monitors.length > 0 && (
              <CollapsibleSection title="Monitoring" count={monitors.length}>
                {monitors.map((m) => (
                  <MonitorListCard key={m.id} monitor={m} onNavigate={onNavigate} />
                ))}
              </CollapsibleSection>
            )}
            {batches.length > 0 && (
              <CollapsibleSection title="Batches" count={batches.length}>
                {batches.map((b) => (
                  <BatchListCard key={b.id} batch={b} onNavigate={onNavigate} />
                ))}
              </CollapsibleSection>
            )}
            {sorted.length > 0 && (
              <CollapsibleSection title="Single Report" count={sorted.length}>
                {sorted.map((s) => (
                  <ScreeningCard key={s.id} screening={s} query={query.trim()} onNavigate={onNavigate} />
                ))}
              </CollapsibleSection>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Persistent left column on `lg+`; the master half of the master-detail split.
 */
export function VesselScreeningSidebar({ className }: { className?: string }) {
  const [collapsed, setCollapsed] = useSidebarCollapsed()
  const navigate = useNavigate()
  const { screeningId } = useParams({ strict: false })
  const { data } = useScreenings()
  const sorted = useFilteredScreenings(data ?? [], "", EMPTY_FILTERS)
  const currentIndex = screeningId ? sorted.findIndex((s) => s.id === screeningId) : -1
  const prevScreening = currentIndex > 0 ? sorted[currentIndex - 1] : undefined
  const nextScreening =
    currentIndex >= 0 && currentIndex < sorted.length - 1 ? sorted[currentIndex + 1] : undefined

  function goTo(id: string) {
    navigate({ to: "/vessel-screening/$screeningId", params: { screeningId: id } })
  }

  return (
    <aside
      className={cn(
        // `main` (app-shell) has `p-6`; cancel it on all but the right edge so
        // the rail sits flush against the header, the left edge, and the
        // footer — `h-[calc(100%+3rem)]` grows back over the top+bottom
        // padding it just escaped, giving it exactly the fixed space between
        // header and footer regardless of how tall the outlet's content is.
        "hidden shrink-0 overflow-hidden border-r transition-[width] duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none lg:-mt-6 lg:-mb-6 lg:-ml-6 lg:flex lg:h-[calc(100%+3rem)] lg:flex-col",
        collapsed ? "lg:w-10" : "lg:w-80",
        className
      )}
    >
      {collapsed && (
        <div className="flex flex-col items-center gap-1 pt-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Show screenings list"
            onClick={() => setCollapsed(false)}
          >
            <IconLayoutSidebarLeftExpand className="size-4" />
          </Button>
          {currentIndex >= 0 && (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Previous report"
                disabled={!prevScreening}
                onClick={() => prevScreening && goTo(prevScreening.id)}
              >
                <IconChevronUp className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Next report"
                disabled={!nextScreening}
                onClick={() => nextScreening && goTo(nextScreening.id)}
              >
                <IconChevronDown className="size-4" />
              </Button>
            </>
          )}
        </div>
      )}
      <div className={cn("flex min-h-0 flex-1 flex-col", collapsed && "hidden")}>
        <SidebarBody
          collapseButton={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Hide screenings list"
              className="shrink-0"
              onClick={() => setCollapsed(true)}
            >
              <IconLayoutSidebarLeftCollapse className="size-4" />
            </Button>
          }
        />
      </div>
    </aside>
  )
}

/** Below `lg`, the list lives in a slide-over instead of a persistent column. */
export function VesselScreeningMobileTrigger() {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="outline" size="sm" className="mb-4 gap-1.5 lg:hidden" />}
      >
        <IconShip className="size-4" />
        Screenings
      </SheetTrigger>
      <SheetContent side="left" className="w-80 gap-0 p-0">
        <SheetHeader className="border-b p-3">
          <SheetTitle>Screenings</SheetTitle>
        </SheetHeader>
        <SidebarBody onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
