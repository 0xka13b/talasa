import { useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"
import { IconFilter, IconRadar2, IconSearch, IconX } from "@tabler/icons-react"
import type { VesselBrief } from "@talasa/shared"
import { buttonVariants, Button } from "@/components/ui/button"
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
import { CountryFlag } from "@/lib/country-flag"
import { highlightMatches } from "@/lib/highlight-match"
import { cn } from "@/lib/utils"
import { CategoryBadge, EmptyPanel } from "./field"

type Sister = VesselBrief["fleet"]["sisters"][number]
type Status = "sanctioned" | "concern" | "clean"

const STATUS_LABEL: Record<Status, string> = {
  sanctioned: "Sanctioned",
  concern: "Of interest",
  clean: "Clean",
}

function sisterStatus(s: Sister): Status {
  if (s.sanctioned || s.category === "sanctioned") return "sanctioned"
  if (s.category) return "concern"
  return "clean"
}

function matchesQuery(s: Sister, q: string) {
  if (!q) return true
  return [s.name, s.imo, s.flag, s.type].some((f) =>
    f?.toLowerCase().includes(q)
  )
}

export function FleetPanel({ b }: { b: VesselBrief }) {
  const { fleet } = b
  const [query, setQuery] = useState("")
  const [statuses, setStatuses] = useState<Set<Status>>(new Set())

  const sanctionedSisters = fleet.sisters.filter((s) => s.sanctioned).length
  // Sisters flagged by a non-sanction category (linked / PEP / POI, e.g. a
  // shadow-fleet "entity of interest") — surfaced alongside the sanctioned count.
  const concernSisters = fleet.sisters.filter(
    (s) => s.category && s.category !== "sanctioned"
  ).length

  const trimmedQuery = query.trim().toLowerCase()
  const isFiltered = trimmedQuery.length > 0 || statuses.size > 0
  const filteredSisters = useMemo(
    () =>
      fleet.sisters.filter(
        (s) =>
          matchesQuery(s, trimmedQuery) &&
          (statuses.size === 0 || statuses.has(sisterStatus(s)))
      ),
    [fleet.sisters, trimmedQuery, statuses]
  )

  function toggleStatus(status: Status) {
    const next = new Set(statuses)
    next.has(status) ? next.delete(status) : next.add(status)
    setStatuses(next)
  }

  function clearFilters() {
    setQuery("")
    setStatuses(new Set())
  }

  if (fleet.sisters.length === 0) {
    return <EmptyPanel>No sister vessels found.</EmptyPanel>
  }

  return (
    <div className="flex flex-col gap-8">
      {fleet.sisters.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {fleet.sisters.length > 1 && (
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1 sm:max-w-xs">
                  <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name, IMO, flag or type"
                    className={query ? "pr-8 pl-8" : "pl-8"}
                    aria-label="Search sister vessels"
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
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={
                          statuses.size > 0
                            ? `Filter sister vessels (${statuses.size} active)`
                            : "Filter sister vessels"
                        }
                        className="relative shrink-0"
                      />
                    }
                  >
                    <IconFilter className="size-4" />
                    {statuses.size > 0 && (
                      <Badge className="absolute -top-1.5 -right-1.5 h-4 min-w-4 justify-center px-1 text-[10px] tabular-nums">
                        {statuses.size}
                      </Badge>
                    )}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Status</DropdownMenuLabel>
                      {(["sanctioned", "concern", "clean"] as const).map(
                        (status) => (
                          <DropdownMenuCheckboxItem
                            key={status}
                            checked={statuses.has(status)}
                            onCheckedChange={() => toggleStatus(status)}
                          >
                            {STATUS_LABEL[status]}
                          </DropdownMenuCheckboxItem>
                        )
                      )}
                    </DropdownMenuGroup>
                    {statuses.size > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setStatuses(new Set())}
                        >
                          Clear filters
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
            <span className="ml-auto text-sm text-muted-foreground">
              {sanctionedSisters} sanctioned
              {concernSisters > 0
                ? `, ${concernSisters} of interest`
                : ""} of {fleet.sisters.length} screened
            </span>
          </div>

          {isFiltered && (
            <p className="text-xs text-muted-foreground">
              Showing {filteredSisters.length} of {fleet.sisters.length}
            </p>
          )}

          {filteredSisters.length === 0 ? (
            <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
              No sister vessels match your search or filters.{" "}
              <button
                type="button"
                onClick={clearFilters}
                className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
              >
                Clear filters
              </button>
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-lg border">
              {filteredSisters.map((s, i) => (
                <li
                  key={`${s.imo}-${i}`}
                  className={cn(
                    "group relative flex flex-wrap items-center justify-between gap-2 overflow-hidden p-3",
                    s.sanctioned
                      ? "bg-red-500/5"
                      : s.category
                        ? "bg-amber-500/5"
                        : ""
                  )}
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {s.name
                          ? highlightMatches(s.name, trimmedQuery)
                          : "Unnamed vessel"}
                      </span>
                      <CategoryBadge
                        category={s.category}
                        sanctioned={s.sanctioned}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      IMO {highlightMatches(s.imo, trimmedQuery)}
                    </span>
                  </div>
                  {/* Sister-vessel identity, fading out to make room for the
                    slide-in "New screening" action on hover/focus. */}
                  <span className="flex flex-wrap gap-x-3 text-sm text-muted-foreground transition-opacity duration-200 group-focus-within:opacity-0 group-hover:opacity-0">
                    {s.type && (
                      <span>{highlightMatches(s.type, trimmedQuery)}</span>
                    )}
                    {s.flag && (
                      <span className="flex items-center gap-1">
                        <CountryFlag country={s.flag} />
                        {highlightMatches(s.flag, trimmedQuery)}
                      </span>
                    )}
                  </span>
                  <Link
                    to="/vessel-screening/new"
                    search={{ imo: s.imo }}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Start a new screening for IMO ${s.imo} in a new tab`}
                    className={cn(
                      buttonVariants({ variant: "default", size: "sm" }),
                      "absolute top-1/2 right-3 translate-x-[calc(100%+0.75rem)] -translate-y-1/2 opacity-0 shadow-sm transition-all duration-200 group-focus-within:translate-x-0 group-focus-within:opacity-100 group-hover:translate-x-0 group-hover:opacity-100"
                    )}
                  >
                    <IconRadar2 className="size-4" /> New screening
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {fleet.truncated && fleet.note && (
        <p className="text-sm text-muted-foreground italic">{fleet.note}</p>
      )}
    </div>
  )
}
