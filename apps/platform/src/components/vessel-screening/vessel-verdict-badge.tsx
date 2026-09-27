import type { VesselVerdict } from "@talasa/shared"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const VERDICT_CLASS: Record<VesselVerdict, string> = {
  PROCEED: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  CAUTION: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  BLOCK: "bg-red-500/15 text-red-600 dark:text-red-400",
}

export function VesselVerdictBadge({
  verdict,
  className,
}: {
  verdict: VesselVerdict
  className?: string
}) {
  return (
    <Badge
      className={cn(
        "font-semibold tracking-wide",
        VERDICT_CLASS[verdict],
        className
      )}
    >
      {verdict}
    </Badge>
  )
}
