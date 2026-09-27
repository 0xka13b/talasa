import type { VesselBrief, VesselHistoryChange } from "@talasa/shared"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { CountryFlag } from "@/lib/country-flag"
import { cn } from "@/lib/utils"
import { DefinitionGrid, Field, SectionHeading, SuspectBadge } from "./field"
import { formatDate, formatHistoryKind } from "../vessel-labels"

// Grid-rows transition instead of Base UI's JS-measured height var: that var
// is captured once per open/close and can lock in a stale pixel height (and
// clip content) if a section's content is taller than what got measured.
// grid-template-rows tracks the panel's real intrinsic height continuously.
const COLLAPSIBLE_CONTENT_CLASS =
  "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out data-open:grid-rows-[1fr] data-open:opacity-100 data-[starting-style]:grid-rows-[0fr] data-[starting-style]:opacity-0 data-[ending-style]:grid-rows-[0fr] data-[ending-style]:opacity-0"

export function VesselPanel({ b }: { b: VesselBrief }) {
  const id = b.identity
  const history = b.history
  const inspections = b.inspections
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <SectionHeading className="text-2xl">Particulars</SectionHeading>
        <DefinitionGrid>
          <Field label="Name" value={id.name} />
          <Field label="IMO" value={id.imo} />
          <Field label="MMSI" value={id.mmsi} />
          <Field label="Call sign" value={id.callSign} />
          <Field label="Type" value={id.type} />
          <Field
            label="Flag"
            value={
              id.flag ? (
                <span className="flex flex-wrap items-center gap-2">
                  <CountryFlag country={id.flag} />
                  {id.flag}
                  {id.riskyFlag && (
                    <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400">
                      High-risk
                    </Badge>
                  )}
                </span>
              ) : null
            }
          />
          <Field label="Class society" value={id.classSociety} />
          <Field label="Status" value={id.status} />
          <Field
            label="Gross tonnage"
            value={id.grossTonnage?.toLocaleString()}
          />
          <Field label="Deadweight" value={id.deadweight?.toLocaleString()} />
          <Field label="Year built" value={id.yearBuilt} />
        </DefinitionGrid>
      </section>

      <Collapsible>
        <CollapsibleTrigger className="group/psc flex w-full flex-col gap-3 rounded-lg py-4 text-left transition-colors">
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col">
              <SectionHeading className="text-2xl">
                Port State Control &amp; inspections
              </SectionHeading>
              <span className="text-sm text-muted-foreground">
                Detention and Memorandum-of-Understanding performance
              </span>
            </div>
            <span className="shrink-0 text-sm font-medium text-muted-foreground group-data-[panel-open]/psc:hidden">
              Show more
            </span>
            <span className="hidden shrink-0 text-sm font-medium text-muted-foreground group-data-[panel-open]/psc:inline">
              Show less
            </span>
          </div>
          {(id.detentionRate || inspections) && (
            <div className="flex flex-wrap items-center gap-2">
              {id.detentionRate && (
                <Badge variant="secondary">
                  Detention rate {id.detentionRate}
                </Badge>
              )}
              {inspections && (
                <>
                  <Badge variant="secondary">
                    {inspections.total} inspections
                  </Badge>
                  {inspections.detentions > 0 && (
                    <Badge variant="destructive">
                      {inspections.detentions} detention
                      {inspections.detentions === 1 ? "" : "s"}
                    </Badge>
                  )}
                  {inspections.deficiencies > 0 && (
                    <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400">
                      {inspections.deficiencies} deficiencies
                    </Badge>
                  )}
                </>
              )}
            </div>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className={COLLAPSIBLE_CONTENT_CLASS}>
          <div className="overflow-hidden">
            <DefinitionGrid className="pt-5">
              <Field label="Detention rate" value={id.detentionRate} />
              <Field label="Paris MoU" value={id.parisMou} />
              <Field label="Tokyo MoU" value={id.tokyoMou} />
            </DefinitionGrid>
            {inspections && (
              <div className="flex flex-col gap-4 pt-6">
                {inspections.records.length > 0 && (
                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-xs text-muted-foreground uppercase">
                          <th className="p-2 text-left font-medium">
                            Authority
                          </th>
                          <th className="p-2 text-left font-medium">Port</th>
                          <th className="p-2 text-left font-medium">Date</th>
                          <th className="p-2 text-right font-medium">
                            Deficiencies
                          </th>
                          <th className="p-2 text-right font-medium">
                            Detained
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {inspections.records.map((r, i) => (
                          <tr
                            key={`${r.date ?? ""}-${r.port ?? ""}-${i}`}
                            className={cn(
                              r.suspect
                                ? "bg-amber-500/5"
                                : r.detained && "bg-red-500/5"
                            )}
                          >
                            <td className="p-2">
                              <span className="flex flex-wrap items-center gap-1.5">
                                {r.authority ?? "—"}
                                {r.suspect && (
                                  <SuspectBadge label={r.suspectLabel} />
                                )}
                              </span>
                            </td>
                            <td className="p-2">{r.port ?? "—"}</td>
                            <td className="p-2 text-muted-foreground tabular-nums">
                              {formatDate(r.date)}
                            </td>
                            <td className="p-2 text-right tabular-nums">
                              {r.deficiencies ?? "—"}
                            </td>
                            <td className="p-2 text-right">
                              {r.detained ? (
                                <Badge variant="destructive">Yes</Badge>
                              ) : (
                                <span className="text-muted-foreground">
                                  No
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {history && history.entries.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="group/hist flex w-full flex-col gap-3 rounded-lg py-4 text-left transition-colors">
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col">
                <SectionHeading className="text-2xl">
                  Ship history
                </SectionHeading>
                <span className="text-sm text-muted-foreground">
                  Name, flag, class and ownership changes on record
                </span>
              </div>
              <span className="shrink-0 text-sm font-medium text-muted-foreground group-data-[panel-open]/hist:hidden">
                Show more
              </span>
              <span className="hidden shrink-0 text-sm font-medium text-muted-foreground group-data-[panel-open]/hist:inline">
                Show less
              </span>
            </div>
            {(history.flagChanges > 0 || history.nameChanges > 0) && (
              <div className="flex flex-wrap gap-2">
                {history.flagChanges > 0 && (
                  <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    Flag changed {history.flagChanges}×
                  </Badge>
                )}
                {history.nameChanges > 0 && (
                  <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    Renamed {history.nameChanges}×
                  </Badge>
                )}
              </div>
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className={COLLAPSIBLE_CONTENT_CLASS}>
            <div className="overflow-hidden">
              <div className="flex flex-col gap-4 pt-5">
                <ShipHistoryTimeline entries={history.entries} />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {b.geography.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="group/geo flex w-full flex-wrap items-center justify-between gap-3 rounded-lg py-4 text-left transition-colors">
            <div className="flex flex-col">
              <SectionHeading className="text-2xl">
                Geographic movements
              </SectionHeading>
              <span className="text-sm text-muted-foreground">
                Recent sighting areas — suspect-country visits highlighted
              </span>
            </div>
            <span className="shrink-0 text-sm font-medium text-muted-foreground group-data-[panel-open]/geo:hidden">
              Show more
            </span>
            <span className="hidden shrink-0 text-sm font-medium text-muted-foreground group-data-[panel-open]/geo:inline">
              Show less
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className={COLLAPSIBLE_CONTENT_CLASS}>
            <div className="overflow-hidden">
              <div className="pt-5">
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-xs text-muted-foreground uppercase">
                        <th className="p-2 text-left font-medium">Date</th>
                        <th className="p-2 text-left font-medium">Area</th>
                        <th className="p-2 text-left font-medium">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {b.geography.map((g, i) => (
                        <tr
                          key={`${g.date ?? ""}-${g.area ?? ""}-${i}`}
                          className={cn(g.suspect && "bg-amber-500/5")}
                        >
                          <td className="p-2 whitespace-nowrap text-muted-foreground tabular-nums">
                            {formatDate(g.date)}
                          </td>
                          <td className="p-2">
                            <span className="flex flex-wrap items-center gap-1.5">
                              {g.area ?? "—"}
                              {g.suspect && (
                                <SuspectBadge label={g.suspectLabel} />
                              )}
                            </span>
                          </td>
                          <td className="p-2 text-muted-foreground">
                            {g.source ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}

// Where each change category sits in the timeline stack — the identity changes
// that matter most for shadow-fleet screening (flag, name) lead, then the
// commercial chain (owner, manager), with class and anything else last.
function groupRank(label: string): number {
  const l = label.toLowerCase()
  if (l === "flag") return 0
  if (l === "name") return 1
  if (l.includes("owner")) return 2
  if (l.includes("manager")) return 3
  if (l === "classification") return 5
  return 4
}

// Sortable YYYYMMDD key from an ISO or Equasis DD/MM/YYYY date; undated rows
// sort to the bottom (oldest-unknown).
function dateSortKey(v: string | null): number {
  if (!v) return -1
  const t = v.trim()
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t)
  if (m) return Number(`${m[1]}${m[2]}${m[3]}`)
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t)
  if (m)
    return Number(`${m[3]}${m[2].padStart(2, "0")}${m[1].padStart(2, "0")}`)
  return -1
}

/**
 * Ship history as a set of per-category vertical timelines — one stack per
 * change kind (flag, name, owner, ISM manager…), newest at the top with the
 * live value marked "Current". Reads far better than a flat mixed table when a
 * vessel has hopped flags and owners repeatedly.
 */
function ShipHistoryTimeline({ entries }: { entries: VesselHistoryChange[] }) {
  const groups = new Map<string, VesselHistoryChange[]>()
  for (const e of entries) {
    const label = formatHistoryKind(e.kind)
    const arr = groups.get(label) ?? []
    arr.push(e)
    groups.set(label, arr)
  }
  const ordered = [...groups.entries()].sort(
    (a, z) => groupRank(a[0]) - groupRank(z[0])
  )
  for (const [, arr] of ordered) {
    arr.sort((a, z) => dateSortKey(z.from) - dateSortKey(a.from))
  }

  return (
    <div className="flex flex-col gap-6">
      {ordered.map(([label, items]) => (
        <div key={label} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {label}
            </h4>
            {items.length > 1 && (
              <span className="text-xs text-muted-foreground">
                {items.length} on record
              </span>
            )}
          </div>
          <ol className="relative flex flex-col ps-2">
            {items.map((e, idx) => {
              const current = idx === 0
              const last = idx === items.length - 1
              return (
                <li
                  key={`${e.value ?? ""}-${e.from ?? ""}-${idx}`}
                  className="relative flex gap-3 pb-5 last:pb-0"
                >
                  {!last && (
                    <span
                      aria-hidden
                      className="absolute top-2 bottom-0 left-[4px] w-px bg-border"
                    />
                  )}
                  <span
                    className={cn(
                      "relative z-10 mt-1 size-2.5 shrink-0 rounded-full",
                      current
                        ? "bg-primary ring-4 ring-primary/20"
                        : "border-2 border-muted-foreground/40 bg-background"
                    )}
                  />
                  <div className="-mt-0.5 flex flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-1.5 text-sm">
                      <span
                        className={cn(
                          "font-medium",
                          !current && "text-muted-foreground"
                        )}
                      >
                        {e.value ?? "—"}
                      </span>
                      {current && (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-normal"
                        >
                          Current
                        </Badge>
                      )}
                      {e.suspect && <SuspectBadge label={e.suspectLabel} />}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatDate(e.from)}
                    </span>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      ))}
    </div>
  )
}
