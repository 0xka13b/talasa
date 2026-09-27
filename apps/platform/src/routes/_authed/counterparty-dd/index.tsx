import { createFileRoute } from "@tanstack/react-router"
import { IconBuilding } from "@tabler/icons-react"
import { useProjects } from "@/hooks/use-projects"
import { DDEmpty } from "@/components/counterparty-dd/dd-empty"
import { FullScreenSpinner } from "@/components/layout/full-screen-spinner"

export const Route = createFileRoute("/_authed/counterparty-dd/")({ component: ProjectsIndexPage })

function ProjectsIndexPage() {
  const { data, isPending } = useProjects()
  if (isPending) return <FullScreenSpinner />
  if ((data ?? []).length === 0) return <DDEmpty />
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-center">
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <IconBuilding className="size-6" />
      </div>
      <p className="text-sm font-medium">No project selected</p>
      <p className="max-w-xs text-sm text-muted-foreground">
        Choose a project from the list to view its risk band and full due-diligence brief.
      </p>
    </div>
  )
}
