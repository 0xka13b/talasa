import { createFileRoute } from "@tanstack/react-router"
import { BatchDetail } from "@/components/vessel-screening/batch/batch-detail"

export const Route = createFileRoute("/_authed/vessel-screening/batch/$batchId")({
  component: BatchDetailPage,
})

function BatchDetailPage() {
  const { batchId } = Route.useParams()
  return <BatchDetail batchId={batchId} />
}
