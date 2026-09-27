import { IconFile, IconClock, IconLoader2, IconX, IconChecks } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import { PROJECT_STATUS_LABELS } from "@talasa/shared"
import type { ProjectStatus } from "@talasa/shared"

type Variant = "default" | "secondary" | "outline" | "destructive"

const STATUS_VARIANT: Record<ProjectStatus, Variant> = {
  draft: "outline",
  queued: "secondary",
  running: "secondary",
  completed: "secondary",
  failed: "destructive",
}

const STATUS_ICON: Record<ProjectStatus, typeof IconFile> = {
  draft: IconFile,
  queued: IconClock,
  running: IconLoader2,
  completed: IconChecks,
  failed: IconX,
}

export function ProjectStatusBadge({ status, label }: { status: ProjectStatus; label?: string }) {
  const Icon = STATUS_ICON[status]
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      <Icon data-icon="inline-start" className={status === "running" ? "animate-spin" : undefined} />
      {label ?? PROJECT_STATUS_LABELS[status]}
    </Badge>
  )
}
