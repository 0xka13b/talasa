import { useEffect, useState } from "react"
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"
import { AppShell } from "@/components/layout/app-shell"
import { FullScreenSpinner } from "@/components/layout/full-screen-spinner"

export const Route = createFileRoute("/_authed")({ component: AuthedLayout })

function AuthedLayout() {
  const navigate = useNavigate()
  const { data, isPending, isRefetching, refetch } = authClient.useSession()
  const [rechecked, setRechecked] = useState(false)

  // Force a fresh session check whenever this guard mounts. better-auth's
  // session atom is a persistent singleton that can hold a stale unauthenticated
  // result from before login (e.g. a prior /dashboard -> /login bounce). Landing
  // here right after signIn would otherwise read that stale null and redirect
  // back to /login before the post-login refetch lands — which is why login only
  // "worked" on the second attempt. We only trust the result after this refetch.
  useEffect(() => {
    let active = true
    Promise.resolve(refetch?.()).finally(() => {
      if (active) setRechecked(true)
    })
    return () => {
      active = false
    }
  }, [refetch])

  useEffect(() => {
    if (rechecked && !isPending && !isRefetching && !data) navigate({ to: "/login" })
  }, [rechecked, isPending, isRefetching, data, navigate])

  // Already have a session -> render immediately; the mount refetch above still
  // revalidates in the background and will redirect if it turns out to be stale.
  if (data) {
    return (
      <AppShell name={data.user.name || data.user.email} email={data.user.email}>
        <Outlet />
      </AppShell>
    )
  }
  // No session yet: wait for the forced recheck to settle before deciding, so we
  // never redirect on a stale null. The redirect (if truly unauthenticated) is
  // handled by the effect above.
  return <FullScreenSpinner />
}
