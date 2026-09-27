import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { VesselBrief } from "@talasa/shared"
import { useState } from "react"
import {
  formatDate,
  formatDatesInText,
  formatSanctionCategory,
  formatSanctionsList,
  formatSanctionsLists,
  formatSanctionsStatus,
  humanizeToken,
  isDirectSanction,
} from "../vessel-labels"
import { DefinitionGrid, Empty, Field, SectionHeading } from "./field"

const SANCTIONS_STATUS_CLASS: Record<string, string> = {
  CONFIRMED: "bg-red-500/15 text-red-600 dark:text-red-400",
  POSSIBLE: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  NO_MATCH: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
}

export function OverviewPanel({ b }: { b: VesselBrief }) {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <SectionHeading className="text-2xl">Sanctions</SectionHeading>
          <Badge className={cn(SANCTIONS_STATUS_CLASS[b.sanctions.status])}>
            {formatSanctionsStatus(b.sanctions.status)}
          </Badge>
        </div>
        {b.sanctions.matches.length === 0 ? (
          <Empty>No sanctions matches.</Empty>
        ) : (
          <ul className="flex flex-col divide-y divide-border border-y">
            {b.sanctions.matches.map((m, i) => (
              <SanctionMatchItem key={`${m.nodeId}-${i}`} m={m} b={b} />
            ))}
          </ul>
        )}
        {b.sanctions.status !== "NO_MATCH" && <SanctionKeyFacts b={b} />}
        {b.sanctions.narrative && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {b.sanctions.narrative}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2 pt-6">
        <SectionHeading className="text-2xl">Executive summary</SectionHeading>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          {formatDatesInText(b.executiveSummary)}
        </p>
      </section>

      <section className="flex flex-col gap-2 pt-6">
        <div className="flex items-center gap-1.5">
          <SectionHeading className="text-2xl">Predictive assessment</SectionHeading>
        </div>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          {formatDatesInText(b.prediction)}
        </p>
      </section>

      {b.dataCompleteness.gaps.length > 0 && (
        <section className="flex flex-wrap items-center gap-1.5 border-t pt-4">
          <span className="text-sm text-muted-foreground">Data gaps</span>
          {b.dataCompleteness.gaps.map((g, i) => (
            <Badge
              key={`${g}-${i}`}
              variant="outline"
              className="text-muted-foreground"
            >
              {humanizeToken(g)}
            </Badge>
          ))}
        </section>
      )}
    </div>
  )
}

function SanctionMatchItem({
  m,
  b,
}: {
  m: VesselBrief["sanctions"]["matches"][number]
  b: VesselBrief
}) {
  const [expanded, setExpanded] = useState(false)
  const category = formatSanctionCategory(m.category)
  const notes = (m.notes ?? []).filter((n) => n.trim().length > 0)
  const hasExtra = Boolean(m.description) || notes.length > 0
  return (
    <li className="flex flex-col gap-1.5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium">{m.entity}</span>
          <Badge
            variant="outline"
            className="text-[10px] font-normal text-muted-foreground"
          >
            {matchRole(m, b)}
          </Badge>
          {category ? (
            <Badge
              variant={isDirectSanction(m.category) ? "destructive" : "secondary"}
              className={cn(
                !isDirectSanction(m.category) &&
                  "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              )}
            >
              {category}
            </Badge>
          ) : (
            <Badge
              variant={m.tier === "hit" ? "destructive" : "secondary"}
              className="capitalize"
            >
              {m.tier}
            </Badge>
          )}
          <span className="text-sm text-muted-foreground tabular-nums">
            {Math.round(m.score * 100)}%
          </span>
        </span>
        {hasExtra && (
          <Button variant="ghost" size="sm" onClick={() => setExpanded((s) => !s)}>
            {expanded ? "Show less" : "Show more"}
          </Button>
        )}
      </div>

      <span className="text-xs text-muted-foreground">
        Matched on {humanizeToken(m.matchField)} in{" "}
        {formatSanctionsLists(m.datasets, m.list)}
      </span>
      {m.lastSeen && (
        <span className="text-xs text-muted-foreground">
          Last listed {formatDate(m.lastSeen)}
        </span>
      )}

      {hasExtra && (
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
            expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="flex flex-col gap-2 overflow-hidden pt-2">
            {m.description && (
              <p className="text-[14px] leading-[1.4] text-muted-foreground">
                {m.description}
              </p>
            )}
            {notes.map((n, i) => (
              <p
                key={i}
                className="text-[14px] leading-[1.4] text-muted-foreground"
              >
                {n}
              </p>
            ))}
          </div>
        </div>
      )}
    </li>
  )
}

/**
 * What a sanctions match is, relative to the screened vessel: the subject
 * itself, a related company (shown with its role), or a sister-fleet vessel.
 * Keyed off the graph nodeId scheme ("imo:<IMO>" / "company:<id>"), with a
 * name-based fallback for briefs written before nodeIds were stable.
 */
function matchRole(
  m: VesselBrief["sanctions"]["matches"][number],
  b: VesselBrief
): string {
  if (m.nodeId === `imo:${b.imo}`) return "Subject"
  if (m.nodeId.startsWith("company:")) {
    const co = b.companies.find(
      (c) => c.companyImo && `company:${c.companyImo}` === m.nodeId
    )
    return co?.role ?? "Company"
  }
  if (m.nodeId.startsWith("imo:")) return "Sister vessel"
  // Fallbacks for older briefs without the "kind:id" nodeId convention.
  if (
    b.identity.name &&
    m.entity.toLowerCase() === b.identity.name.toLowerCase()
  )
    return "Subject"
  const co = b.companies.find(
    (c) => c.name.toLowerCase() === m.entity.toLowerCase()
  )
  return co?.role ?? "Match"
}

/**
 * Distilled, at-a-glance sanctions summary — replaces a hard-to-read designation
 * timeline with a few plain label/value facts derived from the matches + AIS.
 */
function SanctionKeyFacts({ b }: { b: VesselBrief }) {
  const matches = b.sanctions.matches

  // Earliest designation on record → the list that first listed the subject.
  const firstDesignated = matches
    .map((m) => ({ date: m.firstSeen ?? m.lastSeen ?? null, list: m.list }))
    .filter((m): m is { date: string; list: string } => Boolean(m.date))
    .sort((a, z) => a.date.localeCompare(z.date))
    .at(0)

  // Distinct source lists across every match = jurisdictions touched.
  const jurisdictions = new Set<string>()
  for (const m of matches) {
    const codes = m.datasets && m.datasets.length > 0 ? m.datasets : [m.list]
    codes.forEach((c) => jurisdictions.add(c))
  }

  // First cited ship-to-ship loitering event, if AIS surfaced one.
  const sts = b.ais?.events.find((e) => e.kind === "sts_candidate")
  const stsPlace = sts
    ? (sts.place ??
      sts.maritime?.sea ??
      sts.maritime?.nearestPort ??
      sts.highRiskArea ??
      "location undisclosed")
    : null

  // Owners/managers whose parent company is itself sanctioned.
  const parentHits = b.companies
    .filter((c) => c.parentSanctioned)
    .map((c) => c.name)

  return (
    <div className="flex flex-col gap-3 pt-6">
      <SectionHeading className="text-2xl">Key facts</SectionHeading>
      <DefinitionGrid className="gap-y-4 sm:grid-cols-4">
        <Field
          label="First designation"
          value={
            firstDesignated
              ? `${formatSanctionsList(firstDesignated.list)} · ${formatDate(firstDesignated.date)}`
              : null
          }
        />
        <Field
          label="Jurisdictions"
          value={
            jurisdictions.size > 0
              ? `${jurisdictions.size} source list${jurisdictions.size === 1 ? "" : "s"}`
              : null
          }
        />
        <Field
          label="STS event cited"
          value={stsPlace ? `${stsPlace} · IMO ${b.imo}` : null}
        />
        <Field
          label="Parent hits"
          value={parentHits.length > 0 ? parentHits.join(", ") : null}
        />
      </DefinitionGrid>
    </div>
  )
}
