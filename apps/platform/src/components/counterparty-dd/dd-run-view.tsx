import { Button } from "@/components/ui/button"
import { DDStepper } from "./dd-stepper"
import { DDBrief } from "./dd-brief"
import type { Project } from "@talasa/shared"

export function DDRunView({
  project,
  onRun,
  runPending,
}: {
  project: Project
  onRun: () => void
  runPending: boolean
}) {
  if (project.status === "queued" || project.status === "running")
    return <DDStepper project={project} />
  if (project.status === "completed") return <DDBrief brief={project.brief} />
  if (project.status === "failed")
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-destructive text-sm font-medium">Run failed</p>
        <p className="text-muted-foreground text-xs">{project.error ?? "Unknown error"}</p>
        <Button className="mt-2" onClick={onRun} disabled={runPending}>
          Retry
        </Button>
      </div>
    )
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="text-sm font-medium">Ready to run due diligence</p>
      <p className="text-muted-foreground text-xs">{project.counterpartyName}</p>
      <Button className="mt-2" onClick={onRun} disabled={runPending}>
        Run due diligence
      </Button>
    </div>
  )
}
