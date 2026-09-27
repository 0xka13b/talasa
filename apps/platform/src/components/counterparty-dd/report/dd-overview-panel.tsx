import type { Brief, SanctionMatch } from "@talasa/shared"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  DefinitionGrid,
  Empty,
  Field,
  SectionHeading,
} from "@/components/vessel-screening/report/field"
import {
  formatDate,
  formatDatesInText,
  formatSanctionCategory,
  formatSanctionsList,
  formatSanctionsLists,
  formatSanctionsStatus,
  humanizeToken,
  isDirectSanction,
} from "@/components/vessel-screening/vessel-labels"

const SANCTIONS_STATUS_CLASS: Record<string, string> = {
  CONFIRMED: "bg-red-500/15 text-red-600 dark:text-red-400",
  POSSIBLE: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  NO_MATCH: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
}

export function DDOverviewPanel({ b }: { b: Brief }) {
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
              <SanctionMatchItem key={`${m.entity}-${i}`} m={m} b={b} />
            ))}
          </ul>
        )}
        {b.sanctions.status !== "NO_MATCH" && <SanctionKeyFacts b={b} />}
        {b.sanctions.narrative && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {formatDatesInText(b.sanctions.narrative)}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2 pt-6">
        <SectionHeading className="text-2xl">Executive summary</SectionHeading>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          {formatDatesInText(b.executiveSummary)}
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

function SanctionMatchItem({ m, b }: { m: SanctionMatch; b: Brief }) {
  const category = formatSanctionCategory(m.category)
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
              variant={m.tier === 1 ? "destructive" : "secondary"}
              className="capitalize"
            >
              {m.tier === 1 ? "Direct" : "Linked"}
            </Badge>
          )}
          <span className="text-sm text-muted-foreground tabular-nums">
            {Math.round(m.score * 100)}%
          </span>
        </span>
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
    </li>
  )
}

/**
 * What a sanctions match is, relative to the screened counterparty: the subject
 * company itself, or a linked company in its corporate network. DD matches carry
 * no stable nodeId, so this is name-based (case-insensitive), falling back to a
 * neutral "Match" when the entity isn't one we resolved.
 */
function matchRole(m: Brief["sanctions"]["matches"][number], b: Brief): string {
  const entity = m.entity.toLowerCase()
  if (entity === b.counterparty.canonicalName.toLowerCase()) return "Subject"
  if (b.counterparty.aliases.some((a) => a.toLowerCase() === entity))
    return "Subject"
  const linked = b.linkedCompanies.find((c) => c.name.toLowerCase() === entity)
  if (linked)
    return linked.roles.length > 0 ? linked.roles[0] : "Linked company"
  return "Match"
}

/**
 * Distilled, at-a-glance sanctions summary — mirrors the vessel-screening
 * overview panel's key facts, scoped to what a DD brief actually carries (no
 * AIS or parent-sanctioned data at the ownership level here).
 */
function SanctionKeyFacts({ b }: { b: Brief }) {
  const matches = b.sanctions.matches

  const firstDesignated = matches
    .map((m) => ({ date: m.firstSeen ?? m.lastSeen ?? null, list: m.list }))
    .filter((m): m is { date: string; list: string } => Boolean(m.date))
    .sort((a, z) => a.date.localeCompare(z.date))
    .at(0)

  const jurisdictions = new Set<string>()
  for (const m of matches) {
    const codes = m.datasets && m.datasets.length > 0 ? m.datasets : [m.list]
    codes.forEach((c) => jurisdictions.add(c))
  }

  return (
    <div className="flex flex-col gap-3 pt-6">
      <SectionHeading className="text-2xl">Key facts</SectionHeading>
      <DefinitionGrid className="gap-y-4 sm:grid-cols-2">
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
      </DefinitionGrid>
    </div>
  )
}
