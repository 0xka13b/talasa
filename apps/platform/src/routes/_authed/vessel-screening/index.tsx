import { createFileRoute } from "@tanstack/react-router"
import { IconShip } from "@tabler/icons-react"
import { useScreenings } from "@/hooks/use-screenings"
import { VesselScreeningEmpty } from "@/components/vessel-screening/vessel-screening-empty"
import { FullScreenSpinner } from "@/components/layout/full-screen-spinner"

export const Route = createFileRoute("/_authed/vessel-screening/")({ component: VesselScreeningIndexPage })

function VesselScreeningIndexPage() {
  const { data, isPending } = useScreenings()
  if (isPending) return <FullScreenSpinner />
  if ((data ?? []).length === 0) return <VesselScreeningEmpty />
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-center">
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <IconShip className="size-6" />
      </div>
      <p className="text-sm font-medium">No screening selected</p>
      <p className="max-w-xs text-sm text-muted-foreground">
        Choose a screening from the list to view its risk verdict and full intelligence brief.
      </p>
    </div>
  )
}
