import { createFileRoute } from "@tanstack/react-router"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { FullScreenSpinner } from "@/components/layout/full-screen-spinner"
import { ModeSwitcher, PalettePicker } from "@/components/theme/theme-switcher"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

const SECTION_CLASS =
  "flex flex-col gap-6 border-b border-border py-10 first:pt-0 last:border-b-0 last:pb-0"

export const Route = createFileRoute("/_authed/settings")({ component: SettingsPage })

function SettingsPage() {
  const { data, isPending } = authClient.useSession()

  if (isPending || !data) return <FullScreenSpinner />

  const { user } = data
  const displayName = user.name || user.email
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <div className="mx-auto flex w-[60%] min-w-0 flex-col py-2">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <section className={SECTION_CLASS}>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">Profile</h2>
          <p className="text-sm text-muted-foreground">Your personal information.</p>
        </div>

        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarFallback className="text-xl">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-base font-medium">{displayName}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <div className="flex gap-5">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="profile-name" className="text-sm">Name</Label>
              <Input
                id="profile-name"
                className="h-10 text-base"
                defaultValue={user.name}
                placeholder="Your name"
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="profile-email" className="text-sm">Email</Label>
              <Input
                id="profile-email"
                type="email"
                className="h-10 text-base"
                defaultValue={user.email}
                disabled
              />
            </div>
          </div>

          <div>
            <Button
              size="lg"
              onClick={() => toast.success("Profile saved (mock)")}
            >
              Save
            </Button>
          </div>
        </div>
      </section>

      <section className={SECTION_CLASS}>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">Appearance</h2>
          <p className="text-sm text-muted-foreground">Customize how the app looks for you.</p>
        </div>

        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-3">
            <div>
              <h3 className="text-sm font-semibold">Mode</h3>
              <p className="text-sm text-muted-foreground">
                Day, night, or follow your system.
              </p>
            </div>
            <ModeSwitcher />
          </section>

          <section className="flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-semibold">Color palette</h3>
              <p className="text-sm text-muted-foreground">
                Pick an accent scheme. Each one works in both day and night.
              </p>
            </div>
            <PalettePicker />
          </section>
        </div>
      </section>

      <section className={SECTION_CLASS}>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">Account</h2>
          <p className="text-sm text-muted-foreground">Manage your account settings.</p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-dashed p-5 text-base text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">Active sessions</p>
            <p className="text-sm">View and manage your active login sessions across devices. Coming soon.</p>
          </div>
          <div className="rounded-lg border border-dashed p-5 text-base text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">Delete account</p>
            <p className="text-sm">Permanently delete your account and all associated data. Coming soon.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
