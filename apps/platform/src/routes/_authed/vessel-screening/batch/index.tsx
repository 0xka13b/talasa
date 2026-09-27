import { createFileRoute } from "@tanstack/react-router"
import { BatchUpload } from "@/components/vessel-screening/batch/batch-upload"

export const Route = createFileRoute("/_authed/vessel-screening/batch/")({
  component: BatchUpload,
})
