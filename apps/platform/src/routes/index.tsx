import { useEffect } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"

export const Route = createFileRoute("/")({ component: IndexRedirect })

function IndexRedirect() {
  const navigate = useNavigate()
  const { data, isPending } = authClient.useSession()
  useEffect(() => {
    if (isPending) return
    navigate({ to: data ? "/dashboard" : "/login" })
  }, [data, isPending, navigate])
  return null
}
