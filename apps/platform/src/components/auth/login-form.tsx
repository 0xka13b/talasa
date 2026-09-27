import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export interface LoginFormProps {
  pending: boolean
  onSubmit: (values: { email: string; password: string }) => void
}

export function LoginForm({ pending, onSubmit }: LoginFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  return (
    <Card className="relative z-10 w-full max-w-md border-border bg-card/80 py-8 shadow-xl backdrop-blur-sm">
      <CardHeader className="gap-1.5">
        <CardTitle className="text-2xl">Sign in</CardTitle>
        <CardDescription className="text-base">Access your Talasa workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit({ email, password })
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" className="h-11" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" className="h-11" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" size="lg" className="mt-1 h-11 w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
