import { createContext, useContext, useMemo, useState } from "react"
import type { Dispatch, ReactNode, SetStateAction } from "react"
import { Link, useNavigate, useParams } from "@tanstack/react-router"
import {
  IconBuilding,
  IconChevronDown,
  IconChevronUp,
  IconFilter,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconPlus,
  IconSearch,
  IconX,
} from "@tabler/icons-react"
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  RISK_BANDS,
} from "@talasa/shared"
import type { Project, ProjectStatus, RiskBand } from "@talasa/shared"
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useProjects } from "@/hooks/use-projects"
import { cn } from "@/lib/utils"
import { ProjectCard, completedAt, verdictOf } from "./dd-card"

interface Filters {
  statuses: Set<ProjectStatus>
  bands: Set<RiskBand>
}

/**
 * Collapsed state lives here, above the chat panel's open/closed split, so it
 * survives that split's tree swap (opening/closing chat remounts everything
 * under `AppShellBody`, which would otherwise reset a local `useState`).
 */
const SidebarCollapsedContext = createContext<
  [boolean, Dispatch<SetStateAction<boolean>>] | null
>(null)

export function DDSidebarProvider({ children }: { children: ReactNode }) {
  const state = useState(false)
  return (
    <SidebarCollapsedContext.Provider value={state}>
      {children}
    </SidebarCollapsedContext.Provider>
  )
}

function useSidebarCollapsed() {
  const ctx = useContext(SidebarCollapsedContext)
  if (!ctx)
    throw new Error(
      "useSidebarCollapsed must be used within a DDSidebarProvider"
    )
  return ctx
}

const EMPTY_FILTERS: Filters = { statuses: new Set(), bands: new Set() }

function useFilteredProjects(
  projects: Project[],
  query: string,
  filters: Filters
) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return projects.filter((p) => {
      if (filters.statuses.size > 0 && !filters.statuses.has(p.status))
        return false
      if (filters.bands.size > 0) {
        const band = verdictOf(p)
        if (!band || !filters.bands.has(band)) return false
      }
      if (!q) return true
      return [
        p.name,
        p.counterpartyName,
        p.country ?? "",
        p.companyImo ?? "",
      ].some((f) => f.toLowerCase().includes(q))
    })
  }, [projects, query, filters])

  return useMemo(
    () =>
      [...filtered].sort((a, b) =>
        (completedAt(b) ?? b.createdAt).localeCompare(
          completedAt(a) ?? a.createdAt
        )
      ),
    [filtered]
  )
}

function FilterMenu({
  filters,
  onChange,
}: {
  filters: Filters
  onChange: (next: Filters) => void
}) {
  const activeCount = filters.statuses.size + filters.bands.size

  function toggleStatus(status: ProjectStatus) {
    const next = new Set(filters.statuses)
    next.has(status) ? next.delete(status) : next.add(status)
    onChange({ ...filters, statuses: next })
  }

  function toggleBand(band: RiskBand) {
    const next = new Set(filters.bands)
    next.has(band) ? next.delete(band) : next.add(band)
    onChange({ ...filters, bands: next })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            aria-label={
              activeCount > 0
                ? `Filter projects (${activeCount} active)`
                : "Filter projects"
            }
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
          <DropdownMenuLabel>Risk band</DropdownMenuLabel>
          {RISK_BANDS.map((band) => (
            <DropdownMenuCheckboxItem
              key={band}
              checked={filters.bands.has(band)}
              onCheckedChange={() => toggleBand(band)}
            >
              {band}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
        {activeCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onChange(EMPTY_FILTERS)}>
              Clear filters
            </DropdownMenuItem>
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
        <div
          key={i}
          className="h-24 animate-pulse rounded-lg border bg-muted/40"
        />
      ))}
    </div>
  )
}

function SidebarBody({
  onNavigate,
  collapseButton,
}: {
  onNavigate?: () => void
  collapseButton?: ReactNode
}) {
  const { data, isPending } = useProjects()
  const projects = data ?? []
  const [query, setQuery] = useState("")
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const sorted = useFilteredProjects(projects, query, filters)
  const isFiltered =
    query.trim().length > 0 ||
    filters.statuses.size > 0 ||
    filters.bands.size > 0

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-2 border-b p-3">
        <div className="flex items-center gap-2">
          {collapseButton}
          <Link
            to="/counterparty-dd/new"
            onClick={onNavigate}
            className="min-w-0 flex-1"
          >
            <Button className="w-full gap-1.5">
              <IconPlus className="size-4" />
              New DD check
            </Button>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, counterparty or IMO"
              className={query ? "pr-8 pl-8" : "pl-8"}
              aria-label="Search projects"
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
        ) : projects.length === 0 ? (
          <p className="px-1 py-8 text-center text-sm text-muted-foreground">
            No projects yet. Start one above.
          </p>
        ) : sorted.length === 0 ? (
          <p className="px-1 py-8 text-center text-sm text-muted-foreground">
            {isFiltered
              ? "No projects match your search or filters."
              : "No projects yet."}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {sorted.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                query={query.trim()}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Persistent left column on `lg+`; the master half of the master-detail split.
 */
export function DDSidebar({ className }: { className?: string }) {
  const [collapsed, setCollapsed] = useSidebarCollapsed()
  const navigate = useNavigate()
  const { projectId } = useParams({ strict: false })
  const { data } = useProjects()
  const sorted = useFilteredProjects(data ?? [], "", EMPTY_FILTERS)
  const currentIndex = projectId
    ? sorted.findIndex((p) => p.id === projectId)
    : -1
  const prevProject = currentIndex > 0 ? sorted[currentIndex - 1] : undefined
  const nextProject =
    currentIndex >= 0 && currentIndex < sorted.length - 1
      ? sorted[currentIndex + 1]
      : undefined

  function goTo(id: string) {
    navigate({ to: "/counterparty-dd/$projectId", params: { projectId: id } })
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
            aria-label="Show projects list"
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
                disabled={!prevProject}
                onClick={() => prevProject && goTo(prevProject.id)}
              >
                <IconChevronUp className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Next report"
                disabled={!nextProject}
                onClick={() => nextProject && goTo(nextProject.id)}
              >
                <IconChevronDown className="size-4" />
              </Button>
            </>
          )}
        </div>
      )}
      <div
        className={cn("flex min-h-0 flex-1 flex-col", collapsed && "hidden")}
      >
        <SidebarBody
          collapseButton={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Hide projects list"
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
export function DDMobileTrigger() {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="mb-4 gap-1.5 lg:hidden"
          />
        }
      >
        <IconBuilding className="size-4" />
        Projects
      </SheetTrigger>
      <SheetContent side="left" className="w-80 gap-0 p-0">
        <SheetHeader className="border-b p-3">
          <SheetTitle>Projects</SheetTitle>
        </SheetHeader>
        <SidebarBody onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
