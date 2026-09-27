import { STAGE_NAMES } from "@talasa/shared"
import type { Project } from "@talasa/shared"
import { RunProgress } from "@/components/run-progress"

export function DDStepper({ project }: { project: Project }) {
  const done =
    project.progress?.done ??
    (project.steps
      ? Object.values(project.steps).filter((s) => s.status === "done").length
      : 0)
  const total = project.progress?.total ?? STAGE_NAMES.length

  return <RunProgress label="Running due diligence" done={done} total={total} bare />
}
