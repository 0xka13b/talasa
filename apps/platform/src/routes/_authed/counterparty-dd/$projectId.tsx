import { createFileRoute } from "@tanstack/react-router"
import { toast } from "sonner"
import { useProject, useRunProject } from "@/hooks/use-projects"
import { ProjectStatusBadge } from "@/components/projects/project-status-badge"
import { DDRunView } from "@/components/counterparty-dd/dd-run-view"
import { ChatWithAgentButton } from "@/components/chat/chat-with-agent-button"
import { useRegisterChatSubject } from "@/components/chat/chat-panel-context"
import { FullScreenSpinner } from "@/components/layout/full-screen-spinner"

export const Route = createFileRoute("/_authed/counterparty-dd/$projectId")({
  component: ProjectDetailPage,
})

function ProjectDetailPage() {
  const { projectId } = Route.useParams()
  const { data: project, isPending } = useProject(projectId)
  const run = useRunProject()
  useRegisterChatSubject({
    type: "project",
    id: projectId,
    name: project?.counterpartyName ?? "Counterparty DD",
  })
  if (isPending || !project) return <FullScreenSpinner />
  // Show WHEN the run reached its terminal state next to the status pill.
  const settledAt =
    project.status === "completed" || project.status === "failed"
      ? formatWhen(project.updatedAt)
      : null
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="mx-auto flex w-full max-w-[700px] flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            <ProjectStatusBadge status={project.status} />
            {settledAt && (
              <span className="text-sm text-muted-foreground">{settledAt}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-base text-muted-foreground">
            <span className="font-medium text-foreground">
              {project.counterpartyName}
            </span>
            {project.companyImo && <span>IMO {project.companyImo}</span>}
            {project.country && <span>{project.country}</span>}
            {project.role && <span>{project.role}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <ChatWithAgentButton
            subject={{ type: "project", id: project.id, name: project.counterpartyName }}
            disabled={project.status === "queued" || project.status === "running"}
            disabledReason="The agent is available once the due-diligence run finishes."
          />
        </div>
      </div>
      <DDRunView
        project={project}
        runPending={run.isPending}
        onRun={() =>
          run.mutate(project.id, {
            onError: () => toast.error("Couldn't start the run"),
          })
        }
      />
    </div>
  )
}

/** "5 Jul 2026, 14:32" — when a run reached completed/failed. */
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
