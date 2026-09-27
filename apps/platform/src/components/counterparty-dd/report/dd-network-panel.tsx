import { useMemo, useState } from "react"
import { IconFilter, IconSearch, IconX } from "@tabler/icons-react"
import type { Brief } from "@talasa/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { highlightMatches } from "@/lib/highlight-match"
import { cn } from "@/lib/utils"
import {
  CategoryBadge,
  CopyButton,
  Empty,
} from "@/components/vessel-screening/report/field"

type LinkedCompany = Brief["linkedCompanies"][number]
type Status = "sanctioned" | "concern" | "clean"

const STATUS_LABEL: Record<Status, string> = {
  sanctioned: "Sanctioned",
  concern: "Of interest",
  clean: "Clean",
}

/** Directly sanctioned (2) → otherwise flagged (1) → clean (0). */
function concernRank(c: LinkedCompany): number {
  if (c.sanctioned || c.category === "sanctioned") return 2
  if (c.category) return 1
  return 0
}

function companyStatus(c: LinkedCompany): Status {
  if (c.sanctioned || c.category === "sanctioned") return "sanctioned"
  if (c.category) return "concern"
  return "clean"
}

function matchesQuery(c: LinkedCompany, q: string) {
  if (!q) return true
  return [c.name, c.address].some((f) => f?.toLowerCase().includes(q))
}

function isOwner(role: string) {
  return /owner/i.test(role)
}

export function DDNetworkPanel({ b }: { b: Brief }) {
  const [query, setQuery] = useState("")
  const [statuses, setStatuses] = useState<Set<Status>>(new Set())

  const trimmedQuery = query.trim().toLowerCase()
  const isFiltered = trimmedQuery.length > 0 || statuses.size > 0

  // Surface the network with the highest-concern parties first: directly
  // sanctioned, then otherwise-flagged, then the rest.
  const companies = useMemo(
    () =>
      [...b.linkedCompanies]
        .filter(
          (c) =>
            matchesQuery(c, trimmedQuery) &&
            (statuses.size === 0 || statuses.has(companyStatus(c)))
        )
        .sort((a, c) => concernRank(c) - concernRank(a)),
    [b.linkedCompanies, trimmedQuery, statuses]
  )

  if (b.linkedCompanies.length === 0) {
    return (
      <Empty>
        No linked companies found — no co-owners or co-managers share vessels
        with the subject.
      </Empty>
    )
  }

  function toggleStatus(status: Status) {
    const next = new Set(statuses)
    next.has(status) ? next.delete(status) : next.add(status)
    setStatuses(next)
  }

  function clearFilters() {
    setQuery("")
    setStatuses(new Set())
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Companies connected to the subject through one or more shared vessels —
        the corporate network surfaced by traversing its fleet&apos;s management
        chains.
      </p>

      {b.linkedCompanies.length > 1 && (
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or address"
              className={query ? "pr-8 pl-8" : "pl-8"}
              aria-label="Search linked companies"
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
                      ? `Filter linked companies (${statuses.size} active)`
                      : "Filter linked companies"
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
                {(["sanctioned", "concern", "clean"] as const).map((status) => (
                  <DropdownMenuCheckboxItem
                    key={status}
                    checked={statuses.has(status)}
                    onCheckedChange={() => toggleStatus(status)}
                  >
                    {STATUS_LABEL[status]}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
              {statuses.size > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setStatuses(new Set())}>
                    Clear filters
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {isFiltered && (
        <p className="text-xs text-muted-foreground">
          Showing {companies.length} of {b.linkedCompanies.length}
        </p>
      )}

      {companies.length === 0 ? (
        <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          No linked companies match your search or filters.{" "}
          <button
            type="button"
            onClick={clearFilters}
            className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
          >
            Clear filters
          </button>
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {companies.map((c, i) => (
            <li
              key={`${c.companyImo ?? c.name}-${i}`}
              className={cn(
                "group/row flex flex-col gap-1.5 rounded-lg border p-4",
                c.sanctioned
                  ? "bg-red-500/5"
                  : c.category
                    ? "bg-amber-500/5"
                    : ""
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">
                  {highlightMatches(c.name, trimmedQuery)}
                </span>
                {c.roles.map((role, j) => (
                  <Badge
                    key={`${role}-${j}`}
                    variant={isOwner(role) ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {role}
                  </Badge>
                ))}
                <CategoryBadge category={c.category} sanctioned={c.sanctioned} />
                <CopyButton
                  text={c.name}
                  className="group-hover/row:opacity-100"
                />
              </div>
              {c.address && (
                <span className="text-sm text-muted-foreground">
                  {highlightMatches(c.address, trimmedQuery)}
                </span>
              )}
              <SharedAndFleet c={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SharedAndFleet({ c }: { c: LinkedCompany }) {
  const shared = c.sharedVesselImos.length
  const fleetCount = c.fleetCount
  const ownFleet = c.fleet
  return (
    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
      <span>
        Shares {shared} vessel{shared === 1 ? "" : "s"} with the subject
        {fleetCount > 0
          ? ` · operates ${fleetCount} vessel${fleetCount === 1 ? "" : "s"}`
          : ""}
      </span>
      {ownFleet.length > 0 && (
        <span>
          Fleet: {ownFleet.map((v) => v.name ?? `IMO ${v.imo}`).join(", ")}
          {fleetCount > ownFleet.length
            ? ` +${fleetCount - ownFleet.length} more`
            : ""}
        </span>
      )}
    </div>
  )
}
