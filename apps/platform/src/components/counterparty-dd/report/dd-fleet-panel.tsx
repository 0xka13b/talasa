import { useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"
import { IconRadar2, IconSearch, IconX } from "@tabler/icons-react"
import type { Brief } from "@talasa/shared"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { highlightMatches } from "@/lib/highlight-match"
import {
  Empty,
  SectionHeading,
} from "@/components/vessel-screening/report/field"
import { formatDate } from "@/components/vessel-screening/vessel-labels"

type FleetVessel = Brief["fleet"][number]

function matchesQuery(v: FleetVessel, q: string) {
  if (!q) return true
  return [v.name, v.imo, v.flag, v.type, v.registeredOwner, v.manager].some(
    (f) => f?.toLowerCase().includes(q)
  )
}

export function DDFleetPanel({ b }: { b: Brief }) {
  const detentions = b.incidents.detentions
  const [query, setQuery] = useState("")

  const trimmedQuery = query.trim().toLowerCase()
  const filteredFleet = useMemo(
    () => b.fleet.filter((v) => matchesQuery(v, trimmedQuery)),
    [b.fleet, trimmedQuery]
  )

  if (b.fleet.length === 0 && detentions.length === 0) {
    return <Empty>No vessels found for this counterparty.</Empty>
  }

  return (
    <div className="flex flex-col gap-8">
      {b.fleet.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <SectionHeading>Fleet</SectionHeading>
            <span className="ml-auto text-sm text-muted-foreground">
              {b.fleet.length} vessel{b.fleet.length === 1 ? "" : "s"} operated
            </span>
          </div>

          {b.fleet.length > 1 && (
            <div className="relative min-w-0 sm:max-w-xs">
              <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, IMO, flag, type or manager"
                className={query ? "pr-8 pl-8" : "pl-8"}
                aria-label="Search fleet vessels"
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
          )}

          {trimmedQuery && (
            <p className="text-xs text-muted-foreground">
              Showing {filteredFleet.length} of {b.fleet.length}
            </p>
          )}

          {filteredFleet.length === 0 ? (
            <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
              No vessels match your search.{" "}
              <button
                type="button"
                onClick={() => setQuery("")}
                className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
              >
                Clear search
              </button>
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-lg border">
              {filteredFleet.map((v, i) => (
                <li
                  key={`${v.imo}-${i}`}
                  className="group relative flex flex-wrap items-center justify-between gap-2 overflow-hidden p-3"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {v.name
                        ? highlightMatches(v.name, trimmedQuery)
                        : "Unnamed vessel"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      IMO {highlightMatches(v.imo, trimmedQuery)}
                      {v.flag ? (
                        <> · {highlightMatches(v.flag, trimmedQuery)}</>
                      ) : (
                        ""
                      )}
                      {v.type ? (
                        <> · {highlightMatches(v.type, trimmedQuery)}</>
                      ) : (
                        ""
                      )}
                    </span>
                    {(v.registeredOwner ?? v.manager) && (
                      <span className="text-xs text-muted-foreground">
                        {v.registeredOwner && (
                          <>Owner: {highlightMatches(v.registeredOwner, trimmedQuery)}</>
                        )}
                        {v.registeredOwner && v.manager ? " · " : ""}
                        {v.manager && (
                          <>Manager: {highlightMatches(v.manager, trimmedQuery)}</>
                        )}
                      </span>
                    )}
                  </div>
                  {/* Deep-link into a full vessel screening for any fleet member,
                      mirroring the sister-fleet action in the vessel report. */}
                  <Link
                    to="/vessel-screening/new"
                    search={{ imo: v.imo }}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Screen vessel IMO ${v.imo} in a new tab`}
                    className={cn(
                      buttonVariants({ variant: "default", size: "sm" }),
                      "absolute top-1/2 right-3 translate-x-[calc(100%+0.75rem)] -translate-y-1/2 opacity-0 shadow-sm transition-all duration-200 group-focus-within:translate-x-0 group-focus-within:opacity-100 group-hover:translate-x-0 group-hover:opacity-100"
                    )}
                  >
                    <IconRadar2 className="size-4" /> Screen vessel
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {(detentions.length > 0 || b.incidents.gaps.length > 0) && (
        <section className="flex flex-col gap-3">
          <SectionHeading>Incidents</SectionHeading>
          {detentions.length === 0 ? (
            <Empty>No detentions recorded across the fleet.</Empty>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-lg border">
              {detentions.map((d, i) => (
                <li key={`${d.imo}-${i}`} className="flex flex-col gap-0.5 p-3">
                  <span className="text-sm font-medium">
                    IMO {d.imo}
                    {d.authority ? ` · ${d.authority}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(d.date)}
                    {d.detail ? ` — ${d.detail}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {b.incidents.gaps.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">
                Coverage gaps
              </span>
              {b.incidents.gaps.map((g, i) => (
                <Badge
                  key={`${g}-${i}`}
                  variant="outline"
                  className="text-muted-foreground"
                >
                  {g}
                </Badge>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
