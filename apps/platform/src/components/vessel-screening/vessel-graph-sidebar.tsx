import { IconX } from "@tabler/icons-react"
import type { GraphNode } from "@talasa/shared"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  formatNodeField,
  formatNodeValue,
  formatSanctionCategory,
  isDirectSanction,
} from "./vessel-labels"

export function VesselGraphSidebar({ node, onClose }: { node: GraphNode; onClose: () => void }) {
  const entries = Object.entries(node.data).filter(([, v]) => v != null && v !== "")
  const category = node.category ?? undefined
  // Same category vocabulary as the sanctions tabs: direct designation red,
  // linked / PEP / POI amber. Falls back to the plain sanctioned flag.
  const direct = isDirectSanction(category) || (node.sanctioned && !category)
  return (
    <aside className="bg-background animate-in slide-in-from-right absolute top-0 right-0 z-10 flex h-full w-80 flex-col gap-4 overflow-y-auto border-l p-5 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-lg leading-tight font-semibold">{node.label}</span>
          <span className="text-muted-foreground text-sm">{node.kind === "vessel" ? "Vessel" : "Legal entity"}{node.sub ? ` · ${node.sub}` : ""}</span>
        </div>
        <button type="button" aria-label="Close" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <IconX className="size-5" />
        </button>
      </div>
      {(category || node.sanctioned) && (
        <Badge
          className={cn(
            "self-start",
            direct ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
          )}
        >
          {category ? formatSanctionCategory(category) : "Sanctioned"}
        </Badge>
      )}
      <dl className="flex flex-col gap-3 text-sm">
        {entries.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-muted-foreground shrink-0">{formatNodeField(k)}</dt>
            <dd className="text-right font-medium break-words">{formatNodeValue(v)}</dd>
          </div>
        ))}
      </dl>
    </aside>
  )
}
