import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_authed/chats")({ component: ChatsPage })

function ChatsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Chats</h1>
      <p className="text-muted-foreground text-sm">Coming soon</p>
    </div>
  )
}
