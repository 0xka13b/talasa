import type { InferredOwnership, VesselBrief } from "@talasa/shared"
import { IconAlertTriangle } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import { CountryFlag } from "@/lib/country-flag"
import { cn } from "@/lib/utils"
import { CategoryBadge, CopyButton, EmptyPanel } from "./field"

function isOwner(role: string) {
  return /owner/i.test(role)
}

type Company = VesselBrief["companies"][number]

/** All roles a company holds, tolerating older briefs that only had `role`. */
function companyRoles(co: Company): string[] {
  return co.roles.length > 0 ? co.roles : [co.role]
}

export function OwnershipPanel({ b }: { b: VesselBrief }) {
  const inferred = b.inferredOwnership ?? null
  const flags = inferred?.flags ?? []
  const hasCompanies = b.companies.length > 0
  if (!hasCompanies && flags.length === 0)
    return <EmptyPanel>No legal entities found.</EmptyPanel>
  // One card per (company, role) — an entity holding several roles (e.g.
  // registered owner AND commercial manager) gets one card each rather than a
  // single merged card. Owner roles pinned to the top so the responsible party
  // reads first.
  const cards = b.companies
    .flatMap((co) => companyRoles(co).map((role) => ({ co, role })))
    .sort((a, c) => Number(isOwner(c.role)) - Number(isOwner(a.role)))
  return (
    <div className="flex flex-col gap-6">
      {flags.length > 0 && <UndisclosedFlags flags={flags} />}
      {hasCompanies && (
        <ul className="flex flex-col gap-3">
          {cards.map(({ co, role }, i) => (
            <li
              key={`${co.companyImo ?? co.name}-${role}-${i}`}
              className="group/row flex flex-col gap-1.5 py-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{co.name}</span>
                  <Badge
                    variant={isOwner(role) ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {role}
                  </Badge>
                  <CategoryBadge
                    category={co.category}
                    sanctioned={co.sanctioned}
                  />
                </div>
                <CopyButton
                  text={co.name}
                  className="group-hover/row:opacity-100"
                />
              </div>
              {co.address && (
                <span className="text-sm text-muted-foreground">
                  {co.address}
                </span>
              )}
              <LegalInfo co={co} />
              <ParentLine co={co} />
            </li>
          ))}
        </ul>
      )}
      {inferred && inferred.entities.length > 0 && (
        <InferredNetwork inferred={inferred} />
      )}
    </div>
  )
}

/**
 * Prominent risk banner for undisclosed/unknown registry ownership — a deliberate
 * concealment tactic. Surfaced whether or not the network could be inferred.
 */
function UndisclosedFlags({
  flags,
}: {
  flags: NonNullable<VesselBrief["inferredOwnership"]>["flags"]
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
        <IconAlertTriangle className="size-4 shrink-0" />
        <span className="text-sm font-semibold">
          Undisclosed registry ownership
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        The party behind {flags.length === 1 ? "this role" : "these roles"} is
        concealed on the registry — a common shadow-fleet ownership-obfuscation
        tactic and a risk indicator in its own right.
      </p>
      <ul className="flex flex-col gap-1.5">
        {flags.map((f, i) => (
          <li
            key={`${f.role}-${i}`}
            className="flex flex-wrap items-center gap-2 text-sm"
          >
            <Badge
              variant="outline"
              className="border-amber-500/40 text-[10px]"
            >
              {f.role}
            </Badge>
            <span className="font-mono text-xs text-amber-700 dark:text-amber-400">
              {f.placeholder}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const STRENGTH_CLASS: Record<string, string> = {
  strong: "bg-red-500/15 text-red-600 dark:text-red-400",
  moderate: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  weak: "bg-muted text-muted-foreground",
}

/**
 * The optional inferred ownership-network table. Clearly labelled as an
 * investigative hypothesis — it NEVER overrides the registry data above.
 */
function InferredNetwork({ inferred }: { inferred: InferredOwnership }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold">Inferred ownership network</h3>
        <p className="text-xs text-muted-foreground">
          Inferred from sanctions-list evidence per our investigation — a
          hypothesis, <span className="font-medium">not registry-confirmed</span>{" "}
          ownership. The registered owner/manager remains undisclosed.
        </p>
      </div>
      {inferred.summary && (
        <p className="text-sm text-muted-foreground">{inferred.summary}</p>
      )}
      <div className="overflow-x-auto rounded-lg border border-dashed">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="border-b text-xs tracking-wide text-muted-foreground uppercase">
              <th className="px-3 py-2 font-medium">Entity</th>
              <th className="px-3 py-2 font-medium">Role as described</th>
              <th className="px-3 py-2 font-medium">Signal strength</th>
            </tr>
          </thead>
          <tbody>
            {inferred.entities.map((e, i) => (
              <tr key={`${e.name}-${i}`} className="border-b last:border-0 align-top">
                <td className="px-3 py-2.5 font-medium">{e.name}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{e.role}</td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-col gap-1.5">
                    <Badge
                      className={cn(
                        "w-fit capitalize",
                        STRENGTH_CLASS[e.strength] ?? STRENGTH_CLASS.weak
                      )}
                    >
                      {e.strength}
                    </Badge>
                    <span className="text-muted-foreground">{e.signal}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function LegalInfo({ co }: { co: Company }) {
  if (!co.lei) return null
  const showLegalName =
    co.legalName && co.legalName.toLowerCase() !== co.name.toLowerCase()
  return (
    <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
      {showLegalName && (
        <span className="mb-1 text-sm">Legal name: {co.legalName}</span>
      )}
      <span className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="font-mono text-[10px]">
          LEI <span>{co.lei}</span>
        </Badge>
        {co.jurisdiction && (
          <span className="flex items-center gap-1">
            <CountryFlag country={co.jurisdiction} />
            {co.jurisdiction}
          </span>
        )}
        {co.registrationStatus && <span>· {co.registrationStatus}</span>}
      </span>
    </div>
  )
}

function ParentLine({ co }: { co: Company }) {
  const parent = co.ultimateParent ?? co.directParent
  if (!parent) return null
  const isUltimate = Boolean(co.ultimateParent)
  // Only surface the parent jurisdiction when it differs from the subsidiary's,
  // to avoid repeating the same country code twice in one entity card.
  const showJurisdiction =
    parent.jurisdiction &&
    parent.jurisdiction.toLowerCase() !== (co.jurisdiction ?? "").toLowerCase()
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">
        {isUltimate ? "Ultimate owner" : "Owner"}:
      </span>
      <span className="font-medium">{parent.legalName}</span>
      {showJurisdiction && (
        <span className="flex items-center gap-1 text-muted-foreground">
          <CountryFlag country={parent.jurisdiction} />
          {parent.jurisdiction}
        </span>
      )}
      {co.parentSanctioned && (
        <Badge variant="destructive">Parent sanctioned</Badge>
      )}
    </div>
  )
}
