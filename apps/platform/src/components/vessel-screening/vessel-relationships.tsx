import { IconChevronRight, IconAlertTriangle } from "@tabler/icons-react"
import type { EntityGraph, GraphNode } from "@talasa/shared"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { buildRelationships, ROLE_LABEL } from "./build-relationships"
import type { RelCompany } from "./build-relationships"

const SANCTIONED_BADGE = "bg-red-500/15 text-red-600 dark:text-red-400"

function SanctionedBadge() {
  return <Badge className={cn("shrink-0", SANCTIONED_BADGE)}>Sanctioned</Badge>
}

export function VesselRelationships({
  graph,
  onSelect,
}: {
  graph: EntityGraph
  onSelect: (node: GraphNode) => void
}) {
  const model = buildRelationships(graph)
  const subject = model.subject

  if (!subject || model.groups.length === 0) {
    return <p className="text-muted-foreground text-sm italic">No related entities found.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Subject */}
      <div className="bg-muted/30 flex flex-col gap-2 rounded-lg border p-3">
        <button
          type="button"
          onClick={() => onSelect(subject)}
          className="hover:bg-muted/60 -m-1 flex items-center gap-2 rounded-md p-1 text-left transition-colors"
        >
          <span className="font-semibold">{subject.label}</span>
          <span className="text-muted-foreground text-xs">
            {subject.data.imo ? `IMO ${String(subject.data.imo)}` : null}
            {subject.sub ? ` · ${subject.sub}` : null}
          </span>
          {subject.sanctioned && <SanctionedBadge />}
        </button>
        {model.sanctionedCount > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
            <IconAlertTriangle className="size-3.5" />
            {model.sanctionedCount} sanctioned {model.sanctionedCount === 1 ? "entity" : "entities"} in this network
          </p>
        )}
      </div>

      {/* Role groups */}
      {model.groups.map((group) => (
        <section key={group.rel} className="flex flex-col gap-1">
          <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {group.label}
          </h3>
          {group.companies.map((company) => (
            <CompanyRow key={company.node.id} company={company} onSelect={onSelect} />
          ))}
        </section>
      ))}
    </div>
  )
}

function CompanyRow({
  company,
  onSelect,
}: {
  company: RelCompany
  onSelect: (node: GraphNode) => void
}) {
  const { node, primaryRole, roles, sisters, fleetSize, sanctionedSisters, truncated } = company
  const extraRoles = roles.filter((r) => r !== primaryRole)
  const hasFleet = sisters.length > 0

  return (
    <Collapsible>
      <div className="hover:bg-muted/40 flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors">
        <button
          type="button"
          onClick={() => onSelect(node)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none"
        >
          <span className="truncate text-sm font-medium">{node.label}</span>
          {node.sanctioned && <SanctionedBadge />}
          {extraRoles.map((r) => (
            <Badge key={r} variant="secondary" className="shrink-0 text-[10px]">
              {ROLE_LABEL[r]}
            </Badge>
          ))}
        </button>

        <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
          {fleetSize > 0
            ? `fleet ${fleetSize}${sanctionedSisters > 0 ? ` · ${sanctionedSisters} sanctioned` : ""}`
            : "no fleet"}
        </span>

        {hasFleet && (
          <CollapsibleTrigger
            aria-label="Toggle fleet"
            className="group/fleet text-muted-foreground hover:text-foreground shrink-0 rounded p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <IconChevronRight className="size-4 transition-transform group-data-[panel-open]/fleet:rotate-90" />
          </CollapsibleTrigger>
        )}
      </div>

      {company.parents.length > 0 && (
        <ul className="border-muted ml-3 flex flex-col gap-0.5 border-l pl-3">
          {company.parents.map((p) => (
            <li key={p.node.id}>
              <button
                type="button"
                onClick={() => onSelect(p.node)}
                className="hover:bg-muted/40 flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs transition-colors"
              >
                <span className="text-muted-foreground">
                  {p.rel === "ultimate_parent" ? "ultimate owner" : "owner"} ·
                </span>
                <span className="truncate font-medium">{p.node.label}</span>
                {p.node.sub ? <span className="text-muted-foreground">· {p.node.sub}</span> : null}
                {p.node.sanctioned && <SanctionedBadge />}
              </button>
            </li>
          ))}
        </ul>
      )}

      {hasFleet && (
        <CollapsibleContent>
          <ul className="border-muted ml-3 flex flex-col gap-0.5 border-l pl-3">
            {sisters.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSelect(s)}
                  className="hover:bg-muted/40 flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs transition-colors"
                >
                  <span className="truncate font-medium">{s.label}</span>
                  {s.data.imo ? (
                    <span className="text-muted-foreground">· IMO {String(s.data.imo)}</span>
                  ) : null}
                  {s.sub ? <span className="text-muted-foreground">· {s.sub}</span> : null}
                  {s.sanctioned && <SanctionedBadge />}
                </button>
              </li>
            ))}
            {truncated && (
              <li className="text-muted-foreground px-1.5 py-1 text-xs italic">
                + {fleetSize - sisters.length} more listed but not detailed
              </li>
            )}
          </ul>
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}
