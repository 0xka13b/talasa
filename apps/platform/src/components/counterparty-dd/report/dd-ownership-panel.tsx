import type { Brief } from "@talasa/shared"
import { Badge } from "@/components/ui/badge"
import { CopyButton, Empty } from "@/components/vessel-screening/report/field"
import { formatDatesInText } from "@/components/vessel-screening/vessel-labels"

type Ownership = NonNullable<Brief["ownership"]>

export function DDOwnershipPanel({ b }: { b: Brief }) {
  const o = b.ownership
  if (!o) {
    return (
      <div className="flex flex-col gap-3">
        <Empty>No corporate ownership record matched in GLEIF.</Empty>
        {b.ownershipNarrative && (
          <p className="text-sm text-muted-foreground">
            {formatDatesInText(b.ownershipNarrative)}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="group/row flex flex-col gap-2 rounded-lg border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">
            {o.legalName ?? b.counterparty.canonicalName}
          </span>
          <Badge variant="secondary" className="text-[10px]">
            Subject
          </Badge>
          {o.matchConfidence && (
            <Badge
              variant="outline"
              className="text-[10px] font-normal text-muted-foreground capitalize"
            >
              {o.matchConfidence} match
            </Badge>
          )}
          <CopyButton
            text={o.legalName ?? b.counterparty.canonicalName}
            className="group-hover/row:opacity-100"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {o.lei ? (
            <Badge variant="outline" className="font-mono text-[10px]">
              LEI <span>{o.lei}</span>
            </Badge>
          ) : (
            <span>LEI unknown</span>
          )}
          {o.jurisdiction && <span>{o.jurisdiction}</span>}
          {o.registrationStatus && <span>· {o.registrationStatus}</span>}
        </div>
        <ParentLine label="Direct parent" parent={o.directParent} subject={o} />
        <ParentLine
          label="Ultimate parent"
          parent={o.ultimateParent}
          subject={o}
        />
      </div>
      {b.ownershipNarrative && (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {formatDatesInText(b.ownershipNarrative)}
        </p>
      )}
    </div>
  )
}

function ParentLine({
  label,
  parent,
  subject,
}: {
  label: string
  parent: Ownership["directParent"]
  subject: Ownership
}) {
  if (!parent) return null
  // Only surface the parent jurisdiction when it differs from the subject's, to
  // avoid repeating the same country code twice in one card.
  const showJurisdiction =
    parent.jurisdiction &&
    parent.jurisdiction.toLowerCase() !==
      (subject.jurisdiction ?? "").toLowerCase()
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{parent.legalName}</span>
      {showJurisdiction && (
        <span className="text-muted-foreground">{parent.jurisdiction}</span>
      )}
    </div>
  )
}
