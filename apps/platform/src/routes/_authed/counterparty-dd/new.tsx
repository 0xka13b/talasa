import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import { useCreateProject, useRunProject } from "@/hooks/use-projects"
import { DDIntakeForm } from "@/components/counterparty-dd/dd-intake-form"

export const Route = createFileRoute("/_authed/counterparty-dd/new")({ component: NewDDPage })

function NewDDPage() {
  const navigate = useNavigate()
  const create = useCreateProject()
  const run = useRunProject()
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <h1 className="text-xl font-semibold">New counterparty check</h1>
      <DDIntakeForm
        pending={create.isPending || run.isPending}
        onSubmit={async (input) => {
          try {
            const project = await create.mutateAsync(input)
            await run.mutateAsync(project.id)
            navigate({ to: "/counterparty-dd/$projectId", params: { projectId: project.id } })
          } catch {
            toast.error("Couldn't start the check")
          }
        }}
      />
    </div>
  )
}
