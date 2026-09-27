import type { ReactNode } from "react"
import { useState } from "react"
import {
  IconAlertTriangle,
  IconCheck,
  IconCopy,
  IconDatabaseOff,
} from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { formatSanctionCategory, isDirectSanction } from "../vessel-labels"

/** Section heading used across report panels. */
export function SectionHeading({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <h3 className={cn("text-base font-semibold", className)}>{children}</h3>
  )
}

/** Muted "nothing here" line. */
export function Empty({ children = "None found." }: { children?: ReactNode }) {
  return <p className="text-sm text-muted-foreground italic">{children}</p>
}

/** Dashed-border "nothing here" placeholder for a whole empty tab — same family as the map-unavailable notice, scaled up for a full panel. */
export function EmptyPanel({
  children = "No content available.",
}: {
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-14 text-center">
      <IconDatabaseOff className="size-5 text-muted-foreground/50" />
      <p className="max-w-sm text-sm text-muted-foreground">{children}</p>
    </div>
  )
}

/** Responsive label/value grid — replaces dot-separated metadata lines. */
export function DefinitionGrid({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3",
        className
      )}
    >
      {children}
    </dl>
  )
}

/** One label/value pair. Renders an em dash when the value is empty. */
export function Field({ label, value }: { label: string; value: ReactNode }) {
  const empty = value === null || value === undefined || value === ""
  const copyText =
    !empty && (typeof value === "string" || typeof value === "number")
      ? String(value)
      : null
  return (
    <div className="group/field flex flex-col gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="flex items-center gap-1.5 text-sm">
        {empty ? "—" : value}
        {copyText && (
          <CopyButton text={copyText} className="group-hover/field:opacity-100" />
        )}
      </dd>
    </div>
  )
}

/** Copy-to-clipboard button. Pass the hover-group class (e.g. `group-hover/row:opacity-100`) matching the ancestor's named group so it reveals on hover/focus. */
export function CopyButton({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className={cn(
        "text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100",
        className
      )}
      aria-label={`Copy ${text}`}
    >
      {copied ? (
        <IconCheck className="size-3.5" />
      ) : (
        <IconCopy className="size-3.5" />
      )}
    </button>
  )
}

const SEVERITY_CLASS: Record<string, string> = {
  blocking: "bg-red-500/15 text-red-600 dark:text-red-400",
  strong: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  weak: "bg-muted text-muted-foreground",
}

/** Colored severity pill (weak / strong / blocking). */
export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <Badge
      className={cn(
        "shrink-0 capitalize",
        SEVERITY_CLASS[severity] ?? SEVERITY_CLASS.weak
      )}
    >
      {severity}
    </Badge>
  )
}

/**
 * The SINGLE sanction-category pill used on every tab (overview, ownership,
 * fleet, graph) so one entity reads identically everywhere — a direct
 * designation is red, a link / PEP / POI is amber. Renders nothing when there's
 * no concern. `sanctioned` is a back-compat fallback for briefs written before
 * the `category` field existed.
 */
export function CategoryBadge({
  category,
  sanctioned,
  className,
}: {
  category?: string | null
  sanctioned?: boolean
  className?: string
}) {
  const cat = category ?? (sanctioned ? "sanctioned" : null)
  if (!cat) return null
  return (
    <Badge
      className={cn(
        "shrink-0",
        isDirectSanction(cat)
          ? "bg-red-500/15 text-red-600 dark:text-red-400"
          : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
        className
      )}
    >
      {formatSanctionCategory(cat)}
    </Badge>
  )
}

/**
 * Amber warning icon flagging a suspect-country visit (e.g. Russia / Iran). The
 * country name is shown on hover rather than inline, so a "Russia" port next to
 * a "Russia" authority doesn't read as "Russia — Russia".
 */
export function SuspectBadge({ label }: { label?: string | null }) {
  const text = label ?? "Suspect country"
  return (
    <Tooltip>
      <TooltipTrigger
        className="inline-flex shrink-0 items-center text-amber-600 dark:text-amber-400"
        aria-label={`Suspect country: ${text}`}
      >
        <IconAlertTriangle className="size-4" />
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  )
}
