import { VESSEL_STAGE_NAMES } from "@talasa/shared"
import type { Screening } from "@talasa/shared"
import { RunProgress } from "@/components/run-progress"

export function VesselStepper({ screening }: { screening: Screening }) {
  const done =
    screening.progress?.done ??
    Object.values(screening.steps).filter((s) => s.status === "done").length
  const total = screening.progress?.total ?? VESSEL_STAGE_NAMES.length

  return <RunProgress label="Screening vessel" done={done} total={total} bare />
}
