import { cn } from "@/lib/utils"

type Health = "operational" | "degraded" | "down"

type StatusItem = {
  label: string
  health: Health
}

const STATUS_ITEMS: StatusItem[] = [
  { label: "API", health: "operational" },
  { label: "Database", health: "operational" },
  { label: "Inference", health: "operational" },
  { label: "AIS Feed", health: "degraded" },
  { label: "Sanctions Sync", health: "operational" },
]

const HEALTH_DOT: Record<Health, string> = {
  operational: "bg-green-500",
  degraded: "bg-orange-500",
  down: "bg-red-500",
}

const HEALTH_TITLE: Record<Health, string> = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Down",
}

export function SystemStatus() {
  return (
    <div className="flex items-center gap-3">
      {STATUS_ITEMS.map((item) => (
        <div key={item.label} className="flex items-center gap-1" title={HEALTH_TITLE[item.health]}>
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", HEALTH_DOT[item.health])} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  )
}
