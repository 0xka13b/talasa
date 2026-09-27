import { useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { queryClient } from "@/lib/query-client"
import { LoginForm } from "@/components/auth/login-form"
import { AuthBackground, AuthBrand } from "@/components/auth/auth-background"

export const Route = createFileRoute("/login")({ component: LoginPage })

function LoginPage() {
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center gap-6 overflow-hidden p-6">
      <AuthBackground />
      <AuthBrand />
      <LoginForm
        pending={pending}
        onSubmit={async ({ email, password }) => {
          setPending(true)
          const { error } = await authClient.signIn.email({ email, password })
          setPending(false)
          if (error) return toast.error(error.message ?? "Sign in failed")
          // Drop any cache carried over from a prior session before this user's
          // data loads — the query keys aren't user-scoped, so stale entries
          // would otherwise leak across accounts.
          queryClient.clear()
          navigate({ to: "/dashboard" })
        }}
      />
    </main>
  )
}
