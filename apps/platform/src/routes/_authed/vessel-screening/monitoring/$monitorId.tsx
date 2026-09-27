import { createFileRoute } from "@tanstack/react-router"
import { MonitorDetail } from "@/components/vessel-screening/monitoring/monitor-detail"

export const Route = createFileRoute("/_authed/vessel-screening/monitoring/$monitorId")({
  component: MonitorDetailPage,
})

function MonitorDetailPage() {
  const { monitorId } = Route.useParams()
  return <MonitorDetail monitorId={monitorId} />
}
