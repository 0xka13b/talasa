import { createFileRoute } from "@tanstack/react-router"
import { MonitorCreate } from "@/components/vessel-screening/monitoring/monitor-create"

export const Route = createFileRoute("/_authed/vessel-screening/monitoring/")({
  component: MonitorCreate,
})
