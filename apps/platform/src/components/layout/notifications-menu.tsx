import { IconBell } from "@tabler/icons-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type NotificationDotColor = "red" | "green" | "blue" | "gray"

interface NotificationItem {
  id: string
  title: string
  time: string
  dotColor: NotificationDotColor
}

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "1",
    title: "Sanctions match flagged — Acme Shipping Ltd",
    time: "2m ago",
    dotColor: "red",
  },
  {
    id: "2",
    title: "Counterparty DD completed — MV Pacific Star",
    time: "1h ago",
    dotColor: "green",
  },
  {
    id: "3",
    title: "Ownership data sync finished",
    time: "3h ago",
    dotColor: "blue",
  },
  {
    id: "4",
    title: "New vessel added to watchlist",
    time: "yesterday",
    dotColor: "gray",
  },
]

const dotColorClass: Record<NotificationDotColor, string> = {
  red: "bg-red-500",
  green: "bg-green-500",
  blue: "bg-blue-500",
  gray: "bg-gray-400",
}

export function NotificationsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative")}
        aria-label="Notifications"
      >
        <IconBell className="size-4" />
        <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-red-500" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-1.5 py-1">
          <DropdownMenuLabel className="p-0 text-sm font-semibold text-foreground">
            Notifications
          </DropdownMenuLabel>
          <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Mark all read
          </button>
        </div>
        <DropdownMenuSeparator />
        {MOCK_NOTIFICATIONS.map((item) => (
          <DropdownMenuItem key={item.id} className="flex items-start gap-2 py-2">
            <span
              className={cn("mt-1 size-2 shrink-0 rounded-full", dotColorClass[item.dotColor])}
            />
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm leading-snug">{item.title}</span>
              <span className="text-xs text-muted-foreground">{item.time}</span>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="justify-center text-xs text-muted-foreground">
          View all
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
