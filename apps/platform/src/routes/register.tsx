import { useState } from "react"
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { queryClient } from "@/lib/query-client"
import { RegisterForm } from "@/components/auth/register-form"
import { AuthBackground, AuthBrand } from "@/components/auth/auth-background"

// Self-signup is disabled — the platform is distributed to pre-provisioned demo
// users only. Keep the page implementation but close the route to direct URLs.
export const Route = createFileRoute("/register")({
  beforeLoad: () => {
    throw redirect({ to: "/login" })
  },
  component: RegisterPage,
})

function RegisterPage() {
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center gap-6 overflow-hidden p-6">
      <AuthBackground />
      <AuthBrand />
      <RegisterForm
        pending={pending}
        onSubmit={async ({ name, email, password }) => {
          setPending(true)
          const { error } = await authClient.signUp.email({ name, email, password })
          setPending(false)
          if (error) return toast.error(error.message ?? "Sign up failed")
          // Start this account with a clean cache — query keys aren't user-scoped,
          // so any carried-over entries would leak across accounts.
          queryClient.clear()
          navigate({ to: "/dashboard" })
        }}
      />
      <p className="relative z-10 text-muted-foreground text-sm">
        Have an account? <Link to="/login" className="underline">Sign in</Link>
      </p>
    </main>
  )
}
