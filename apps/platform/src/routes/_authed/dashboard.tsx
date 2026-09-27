import { createFileRoute } from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"
import { useScreenings } from "@/hooks/use-screenings"
import { useProjects } from "@/hooks/use-projects"
import { Skeleton } from "@/components/ui/skeleton"
import { WelcomeHero } from "@/components/dashboard/welcome-hero"
import { RecentProjects } from "@/components/dashboard/recent-projects"

export const Route = createFileRoute("/_authed/dashboard")({
  component: DashboardPage,
})

function DashboardPage() {
  const { data: session } = authClient.useSession()
  const screenings = useScreenings()
  const projects = useProjects()
  const isPending = screenings.isPending || projects.isPending

  // First name for a warmer greeting; fall back to a friendly default.
  const firstName = session?.user.name.trim().split(/\s+/)[0]

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 py-4">
      <WelcomeHero firstName={firstName} />

      {isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <RecentProjects
          screenings={screenings.data ?? []}
          projects={projects.data ?? []}
        />
      )}
    </div>
  )
}
