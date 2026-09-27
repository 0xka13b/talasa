import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import { useCreateScreening, useRunScreening } from "@/hooks/use-screenings"
import { VesselIntakeForm } from "@/components/vessel-screening/vessel-intake-form"

export const Route = createFileRoute("/_authed/vessel-screening/new")({
  component: NewScreeningPage,
  // Allow deep-linking a pre-filled IMO (e.g. "screen this sister vessel").
  validateSearch: (search: Record<string, unknown>): { imo?: string } => {
    const imo = typeof search.imo === "string" ? search.imo.trim() : ""
    return imo ? { imo } : {}
  },
})

function NewScreeningPage() {
  const navigate = useNavigate()
  const { imo } = Route.useSearch()
  const create = useCreateScreening()
  const run = useRunScreening()
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <h1 className="text-xl font-semibold">New vessel screening</h1>
      <VesselIntakeForm
        initialImo={imo}
        pending={create.isPending || run.isPending}
        onSubmit={async (input) => {
          try {
            const screening = await create.mutateAsync(input)
            await run.mutateAsync(screening.id)
            navigate({
              to: "/vessel-screening/$screeningId",
              params: { screeningId: screening.id },
            })
          } catch {
            toast.error("Couldn't start the screening")
          }
        }}
      />
    </div>
  )
}
