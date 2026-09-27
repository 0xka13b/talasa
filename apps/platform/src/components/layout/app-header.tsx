import { useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  IconDots,
  IconHelpCircle,
  IconScale,
  IconShieldLock,
  IconFileText,
  IconLogout,
  IconSparkles,
  IconMail,
  IconBook2,
} from "@tabler/icons-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authClient } from "@/lib/auth-client"
import { queryClient } from "@/lib/query-client"
import type { NavItem } from "./nav-config"
import { SECTION_NAV, SETTINGS_NAV } from "./nav-config"

const TAB_CLASS =
  "flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-[8px] px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground data-active:bg-accent data-active:text-foreground"

const NAV_GAP_PX = 4 // gap-1

function TabItem({ item }: { item: NavItem }) {
  return (
    <Link to={item.to} activeProps={{ "data-active": true }} className={TAB_CLASS}>
      <item.icon className="size-4" />
      {item.title}
    </Link>
  )
}

// Sections that don't fit collapse into this trigger, trailing item first —
// same priority order as SECTION_NAV.
function OverflowMenu({ items }: { items: NavItem[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="More sections"
        className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[8px] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
      >
        <IconDots className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-52">
        {items.map((item) => (
          <DropdownMenuItem key={item.title} render={<Link to={item.to} activeProps={{ "data-active": true }} />}>
            <item.icon />
            {item.title}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** How many leading SECTION_NAV items fit in `containerWidth`, reserving room for the overflow trigger unless everything fits. */
function computeVisibleCount(containerWidth: number, itemWidths: number[], triggerWidth: number) {
  if (containerWidth <= 0 || itemWidths.length === 0) return itemWidths.length
  const totalWidth = itemWidths.reduce((sum, w) => sum + w, 0) + NAV_GAP_PX * (itemWidths.length - 1)
  if (totalWidth <= containerWidth) return itemWidths.length

  let used = 0
  let count = 0
  for (let i = 0; i < itemWidths.length; i++) {
    const withGap = itemWidths[i] + (i > 0 ? NAV_GAP_PX : 0)
    const isLast = i === itemWidths.length - 1
    const reserve = isLast ? 0 : triggerWidth + NAV_GAP_PX
    if (used + withGap + reserve > containerWidth) break
    used += withGap
    count++
  }
  return count
}

function SectionTabs() {
  const containerRef = useRef<HTMLElement>(null)
  const measureRefs = useRef<(HTMLDivElement | null)[]>([])
  const triggerMeasureRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(SECTION_NAV.length)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const recompute = () => {
      const itemWidths = measureRefs.current.map((el) => el?.offsetWidth ?? 0)
      const triggerWidth = triggerMeasureRef.current?.offsetWidth ?? 0
      setVisibleCount(computeVisibleCount(container.offsetWidth, itemWidths, triggerWidth))
    }

    recompute()
    const observer = new ResizeObserver(recompute)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const visibleItems = SECTION_NAV.slice(0, visibleCount)
  const overflowItems = SECTION_NAV.slice(visibleCount)

  return (
    <nav aria-label="Sections" ref={containerRef} className="flex h-12 min-w-0 flex-1 items-center gap-1 overflow-hidden">
      {/* Off-screen copy of every item, measured once to know real rendered widths. */}
      <div aria-hidden className="pointer-events-none invisible absolute top-0 left-0 flex gap-1">
        {SECTION_NAV.map((item, i) => (
          <div key={item.title} ref={(el) => { measureRefs.current[i] = el }}>
            <TabItem item={item} />
          </div>
        ))}
        <div ref={triggerMeasureRef}>
          <OverflowMenu items={[]} />
        </div>
      </div>

      {visibleItems.map((item) => (
        <TabItem key={item.title} item={item} />
      ))}
      {overflowItems.length > 0 && <OverflowMenu items={overflowItems} />}
    </nav>
  )
}

function AccountMenu({ name, email }: { name: string; email: string }) {
  const navigate = useNavigate()
  const initials = name.slice(0, 2).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open account menu"
        className="flex items-center gap-2 rounded-md p-1 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="hidden max-w-48 truncate text-sm text-muted-foreground sm:inline">{email}</span>
        <Avatar className="size-7 shrink-0">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" sideOffset={8} className="w-56">
        <div className="px-1.5 py-1">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: SETTINGS_NAV.to })}>
          <SETTINGS_NAV.icon />
          {SETTINGS_NAV.title}
        </DropdownMenuItem>
        <DropdownMenuItem render={<a href="https://example.com/ai-guide" target="_blank" rel="noreferrer" />}>
          <IconSparkles />
          Talasa AI Guide
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <IconHelpCircle />
            Get help
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-44">
            <DropdownMenuItem render={<a href="mailto:hello@example.com" />}>
              <IconMail />
              Email us
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate({ to: "/glossary" })}>
              <IconBook2 />
              Glossary
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <IconScale />
            Legal
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-44">
            <DropdownMenuItem render={<a href="https://example.com/privacy" target="_blank" rel="noreferrer" />}>
              <IconShieldLock />
              Privacy policy
            </DropdownMenuItem>
            <DropdownMenuItem render={<a href="https://example.com/terms" target="_blank" rel="noreferrer" />}>
              <IconFileText />
              Terms of use
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={async () => {
            try {
              await authClient.signOut()
            } catch {
              // ignore sign out errors
            } finally {
              // The query cache is a module-level singleton reused across the
              // client-side logout->login navigation, and its keys aren't scoped
              // by user — so without this the next user sees the previous user's
              // cached data. Wipe it on the way out.
              queryClient.clear()
              navigate({ to: "/login" })
            }
          }}
        >
          <IconLogout />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppHeader({ name, email }: { name: string; email: string }) {
  return (
    <header className="sticky top-0 z-20 flex h-12 items-center gap-6 border-b bg-background px-4">
      <Link to="/dashboard" className="flex min-w-0 shrink-0 items-center gap-2.5">
        <span className="grid size-7 place-items-center border border-border bg-black dark:bg-card">
          <img src="/logo-variant.png" alt="Talasa" className="size-5 object-contain" decoding="async" />
        </span>
        <span className="truncate font-mono text-sm tracking-widest text-foreground">TALASA</span>
      </Link>
      <SectionTabs />
      <AccountMenu name={name} email={email} />
    </header>
  )
}
