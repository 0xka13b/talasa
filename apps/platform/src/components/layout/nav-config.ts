import {
  IconLayoutDashboard,
  IconShip,
  IconShieldHalf,
  IconAnchor,
  IconChartLine,
  IconSettings,
} from "@tabler/icons-react"
import type { Icon } from "@tabler/icons-react"

export interface NavItem {
  title: string
  to: string
  icon: Icon
}

// Top-level product sections, rendered as a GitHub repo-nav-style tab strip.
export const SECTION_NAV: NavItem[] = [
  { title: "Dashboard", to: "/dashboard", icon: IconLayoutDashboard },
  { title: "Vessel", to: "/vessel-screening", icon: IconShip },
  { title: "Counterparty DD", to: "/counterparty-dd", icon: IconShieldHalf },
  { title: "Port Intelligence", to: "/port-intelligence", icon: IconAnchor },
  { title: "Fixture Market", to: "/fixture-market", icon: IconChartLine },
]

export const SETTINGS_NAV: NavItem = {
  title: "Settings",
  to: "/settings",
  icon: IconSettings,
}
