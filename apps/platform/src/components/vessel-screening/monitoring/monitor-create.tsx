import { useNavigate } from "@tanstack/react-router"
import { IconRadar2 } from "@tabler/icons-react"
import { MonitorForm } from "./monitor-form"

/** Full-page "create a monitor" form (the /vessel-screening/monitoring route). */
export function MonitorCreate() {
  const navigate = useNavigate()
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <IconRadar2 className="size-5 text-primary" />
          New monitor
        </h1>
        <p className="text-sm text-muted-foreground">
          Re-screen a vessel or a batch on a schedule and get alerted when the checks you care about change.
        </p>
      </div>
      <MonitorForm onCreated={(id) => navigate({ to: "/vessel-screening/monitoring/$monitorId", params: { monitorId: id } })} />
    </div>
  )
}
