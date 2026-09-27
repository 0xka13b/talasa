import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import { IconArchive, IconDots } from "@tabler/icons-react"
import { useScreening, useRunScreening, useArchiveScreening } from "@/hooks/use-screenings"
import { ProjectStatusBadge } from "@/components/projects/project-status-badge"
import { VesselRunView } from "@/components/vessel-screening/vessel-run-view"
import { ExportPdfButton } from "@/components/vessel-screening/vessel-report"
import { ChatWithAgentButton } from "@/components/chat/chat-with-agent-button"
import { useRegisterChatSubject } from "@/components/chat/chat-panel-context"
import { FullScreenSpinner } from "@/components/layout/full-screen-spinner"
import { CountryFlag } from "@/lib/country-flag"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export const Route = createFileRoute("/_authed/vessel-screening/$screeningId")({
  component: ScreeningDetailPage,
})

function ScreeningDetailPage() {
  const { screeningId } = Route.useParams()
  const navigate = useNavigate()
  const { data: screening, isPending } = useScreening(screeningId)
  const run = useRunScreening()
  const archive = useArchiveScreening()
  useRegisterChatSubject({
    type: "screening",
    id: screeningId,
    name: screening?.vesselName ?? screening?.name ?? "Screening",
  })
  if (isPending || !screening) return <FullScreenSpinner />
  // Show WHEN the run reached its terminal state next to the status pill.
  const settledAt =
    screening.status === "completed" || screening.status === "failed"
      ? formatWhen(screening.updatedAt)
      : null
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="mx-auto flex w-full max-w-[700px] flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="text-2xl font-semibold">{screening.name}</h1>
            <ProjectStatusBadge status={screening.status} />
            {settledAt && (
              <span className="text-sm text-muted-foreground">{settledAt}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-base text-muted-foreground">
            {screening.vesselName && (
              <span className="font-medium text-foreground">
                {screening.vesselName}
              </span>
            )}
            <span>IMO {screening.imo}</span>
            {screening.flag && (
              <span className="flex items-center gap-1.5">
                <CountryFlag country={screening.flag} />
                {screening.flag}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <ChatWithAgentButton
            subject={{ type: "screening", id: screening.id, name: screening.vesselName ?? screening.name }}
            disabled={screening.status === "queued" || screening.status === "running"}
            disabledReason="The agent is available once the screening finishes running."
          />
          {screening.status === "completed" && screening.brief != null && (
            <ExportPdfButton brief={screening.brief} graph={screening.graph} />
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="icon" aria-label="More actions" />}
            >
              <IconDots className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={archive.isPending}
                onClick={() =>
                  archive.mutate(screening.id, {
                    onSuccess: () => {
                      toast.success("Report archived")
                      navigate({ to: "/vessel-screening" })
                    },
                    onError: () => toast.error("Couldn't archive the report"),
                  })
                }
              >
                <IconArchive className="size-4" /> Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <VesselRunView
        screening={screening}
        runPending={run.isPending}
        onRun={() =>
          run.mutate(screening.id, {
            onError: () => toast.error("Couldn't start the screening"),
          })
        }
      />
    </div>
  )
}

/** "5 Jul 2026, 14:32" — when a screening reached completed/failed. */
function formatWhen(iso: string): string | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
