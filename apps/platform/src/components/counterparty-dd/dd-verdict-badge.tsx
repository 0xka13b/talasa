import type { RiskBand } from "@talasa/shared"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const BAND_CLASS: Record<RiskBand, string> = {
  CLEAR: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  ENHANCED_DD: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  REJECT: "bg-red-500/15 text-red-600 dark:text-red-400",
}

export function DDVerdictBadge({
  band,
  className,
}: {
  band: RiskBand
  className?: string
}) {
  return (
    <Badge className={cn("font-semibold tracking-wide", BAND_CLASS[band], className)}>
      {band}
    </Badge>
  )
}
