import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { formatSanctionCategory, isDirectSanction } from "../vessel-labels"
import type { EntityFlowNode } from "./to-flow"

function EntityNodeComp({ data, selected }: NodeProps<EntityFlowNode>) {
  const n = data.entity
  const imo = n.kind === "vessel" ? n.data?.imo : null
  const category = n.category ?? undefined
  // Same red/amber vocabulary the sanctions tabs use: a direct designation is
  // red, any softer category (linked / PEP / POI) is amber. `sanctioned` with no
  // category (older graphs) falls back to the red case.
  const direct = isDirectSanction(category) || (n.sanctioned && !category)
  const concern: "direct" | "soft" | "none" = direct ? "direct" : category ? "soft" : "none"
  const label = category ? formatSanctionCategory(category) : n.sanctioned ? "Sanctioned" : null

  return (
    <div
      className={cn(
        "min-w-[150px] max-w-[230px] rounded-lg border-2 bg-background px-3 py-2 shadow-sm",
        concern === "direct" ? "border-red-500/60" : concern === "soft" ? "border-amber-500/60" : "border-border",
        n.isSubject && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        selected && "shadow-md",
      )}
    >
      <Handle type="target" position={Position.Top} className="!size-1.5 !border-0 !bg-muted-foreground/50" />
      <Handle type="source" position={Position.Bottom} className="!size-1.5 !border-0 !bg-muted-foreground/50" />

      <div className="flex items-center gap-1.5">
        <span className="truncate text-sm font-medium">{n.label}</span>
        {n.isSubject && (
          <span className="text-primary shrink-0 text-[10px] font-semibold tracking-wide uppercase">Subject</span>
        )}
      </div>
      {n.sub && <div className="text-muted-foreground truncate text-xs">{n.sub}</div>}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {imo ? <span className="text-muted-foreground text-[10px] tabular-nums">IMO {String(imo)}</span> : null}
        {label && (
          <Badge
            className={cn(
              "text-[10px]",
              concern === "direct"
                ? "bg-red-500/15 text-red-600 dark:text-red-400"
                : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
            )}
          >
            {label}
          </Badge>
        )}
      </div>
    </div>
  )
}

export const EntityNode = memo(EntityNodeComp)
