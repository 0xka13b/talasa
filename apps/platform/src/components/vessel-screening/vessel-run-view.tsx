import type { Screening } from "@talasa/shared"
import { Button } from "@/components/ui/button"
import { VesselStepper } from "./vessel-stepper"
import { VesselReport } from "./vessel-report"

export function VesselRunView({ screening, onRun, runPending }: { screening: Screening; onRun: () => void; runPending: boolean }) {
  if (screening.status === "queued" || screening.status === "running") return <VesselStepper screening={screening} />
  if (screening.status === "completed")
    return (
      <VesselReport
        brief={screening.brief}
        graph={screening.graph}
        screeningId={screening.id}
        graphBoard={screening.graphBoard}
      />
    )
  if (screening.status === "failed")
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-destructive text-sm font-medium">Screening failed</p>
        <p className="text-muted-foreground text-xs">{screening.error ?? "Unknown error"}</p>
        <Button className="mt-2" onClick={onRun} disabled={runPending}>Retry</Button>
      </div>
    )
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="text-sm font-medium">Ready to screen</p>
      <p className="text-muted-foreground text-xs">IMO {screening.imo}</p>
      <Button className="mt-2" onClick={onRun} disabled={runPending}>Start screening</Button>
    </div>
  )
}
