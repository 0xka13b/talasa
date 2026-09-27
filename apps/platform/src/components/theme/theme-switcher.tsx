import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { IconMoon, IconSun, IconDeviceDesktop, IconCheck } from "@tabler/icons-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

/* Mode = light/dark axis. Palette = color-scheme axis (orthogonal). */
export type Theme = "light" | "dark" | "system"
export type Palette = "default" | "miami" | "aubergine" | "sequoia"

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function applyTheme(theme: Theme) {
  const resolved = theme === "system" ? getSystemTheme() : theme
  document.documentElement.classList.toggle("dark", resolved === "dark")
}

function applyPalette(palette: Palette) {
  const el = document.documentElement
  if (palette === "default") el.removeAttribute("data-palette")
  else el.setAttribute("data-palette", palette)
}

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system"
  return (localStorage.getItem("theme") ?? "system") as Theme
}

function getStoredPalette(): Palette {
  if (typeof window === "undefined") return "default"
  return (localStorage.getItem("palette") ?? "default") as Palette
}

export const THEME_ICON: Record<Theme, ReactNode> = {
  light: <IconSun className="size-4" />,
  dark: <IconMoon className="size-4" />,
  system: <IconDeviceDesktop className="size-4" />,
}

export const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Day" },
  { value: "dark", label: "Night" },
  { value: "system", label: "System" },
]

/* Preview colors mirror the real light/dark tokens for each palette (see
 * styles.css) so the card always looks like a mini mock of the currently
 * active mode, instead of a fixed light-side mock. */
type PalettePreview = {
  bg: string
  surface: string
  primary: string
  accent: string
  text: string
  border: string
}

export const PALETTE_OPTIONS: {
  value: Palette
  label: string
  description: string
  preview: PalettePreview
  previewDark: PalettePreview
}[] = [
  {
    value: "default",
    label: "Mono",
    description: "Neutral grayscale",
    preview: {
      bg: "oklch(0.98 0 0)",
      surface: "oklch(1 0 0)",
      primary: "oklch(0.3 0 0)",
      accent: "oklch(0.82 0 0)",
      text: "oklch(0.4 0 0)",
      border: "oklch(0.9 0 0)",
    },
    previewDark: {
      bg: "oklch(0.145 0 0)",
      surface: "oklch(0.205 0 0)",
      primary: "oklch(0.922 0 0)",
      accent: "oklch(0.556 0 0)",
      text: "oklch(0.8 0 0)",
      border: "oklch(1 0 0 / 10%)",
    },
  },
  {
    value: "miami",
    label: "Miami",
    description: "Teal & coral",
    preview: {
      bg: "oklch(0.98 0.01 210)",
      surface: "oklch(1 0.004 210)",
      primary: "oklch(0.62 0.12 200)",
      accent: "oklch(0.68 0.13 350)",
      text: "oklch(0.35 0.03 235)",
      border: "oklch(0.91 0.015 215)",
    },
    previewDark: {
      bg: "oklch(0.2 0.022 240)",
      surface: "oklch(0.24 0.025 240)",
      primary: "oklch(0.72 0.12 195)",
      accent: "oklch(0.72 0.13 350)",
      text: "oklch(0.92 0.015 215)",
      border: "oklch(1 0 0 / 12%)",
    },
  },
  {
    value: "aubergine",
    label: "Aubergine",
    description: "Plum & violet",
    preview: {
      bg: "oklch(0.98 0.01 320)",
      surface: "oklch(1 0.004 320)",
      primary: "oklch(0.53 0.16 305)",
      accent: "oklch(0.62 0.14 340)",
      text: "oklch(0.32 0.04 315)",
      border: "oklch(0.91 0.016 320)",
    },
    previewDark: {
      bg: "oklch(0.19 0.03 310)",
      surface: "oklch(0.23 0.035 310)",
      primary: "oklch(0.7 0.15 305)",
      accent: "oklch(0.7 0.14 340)",
      text: "oklch(0.92 0.02 320)",
      border: "oklch(1 0 0 / 12%)",
    },
  },
  {
    value: "sequoia",
    label: "Sequoia",
    description: "Forest & amber",
    preview: {
      bg: "oklch(0.98 0.012 95)",
      surface: "oklch(1 0.005 95)",
      primary: "oklch(0.52 0.11 155)",
      accent: "oklch(0.7 0.12 85)",
      text: "oklch(0.32 0.03 80)",
      border: "oklch(0.9 0.018 95)",
    },
    previewDark: {
      bg: "oklch(0.21 0.015 100)",
      surface: "oklch(0.25 0.018 100)",
      primary: "oklch(0.7 0.13 155)",
      accent: "oklch(0.76 0.13 85)",
      text: "oklch(0.91 0.015 95)",
      border: "oklch(1 0 0 / 12%)",
    },
  },
]

/**
 * Reads the resolved mode straight off <html class="dark">, the one value
 * `applyTheme` actually writes. Each `useTheme()` call has its own `theme`
 * state (no shared store), so deriving "dark or light" from that local copy
 * goes stale the moment a *different* mounted instance calls `setTheme` —
 * watching the DOM directly keeps every instance in sync instead.
 */
function useResolvedMode(): "light" | "dark" {
  const [isDark, setIsDark] = useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("dark"))

  useEffect(() => {
    const root = document.documentElement
    const observer = new MutationObserver(() => setIsDark(root.classList.contains("dark")))
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  return isDark ? "dark" : "light"
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme)
  const [palette, setPalette] = useState<Palette>(getStoredPalette)
  const mode = useResolvedMode()

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem("theme", theme)
  }, [theme])

  useEffect(() => {
    applyPalette(palette)
    localStorage.setItem("palette", palette)
  }, [palette])

  return { theme, setTheme, palette, setPalette, mode }
}

/** Segmented Day / Night / System control. */
export function ModeSwitcher() {
  const { theme, setTheme } = useTheme()

  return (
    <Tabs value={theme} onValueChange={(value) => setTheme(value as Theme)}>
      <TabsList className="h-auto w-fit gap-1 rounded-[10px] border border-border bg-transparent p-1">
        {THEME_OPTIONS.map((opt) => (
          <TabsTrigger
            key={opt.value}
            value={opt.value}
            className="h-auto flex-none gap-2 rounded-[8px] border-none px-3 py-1.5 text-sm text-muted-foreground shadow-none transition-colors hover:bg-accent/60 hover:text-foreground data-active:border-none data-active:bg-accent data-active:text-foreground data-active:shadow-none"
          >
            {THEME_ICON[opt.value]}
            {opt.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

function PalettePreviewCard({ preview }: { preview: PalettePreview }) {
  return (
    <div
      className="overflow-hidden rounded-lg border"
      style={{ background: preview.bg, borderColor: preview.border }}
    >
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center gap-2">
          <span className="size-3 rounded-full" style={{ background: preview.primary }} />
          <span className="h-2 flex-1 rounded-full" style={{ background: preview.text, opacity: 0.22 }} />
        </div>
        <div
          className="rounded-md border p-2"
          style={{ background: preview.surface, borderColor: preview.border }}
        >
          <span className="block h-2 w-3/4 rounded-full" style={{ background: preview.text, opacity: 0.35 }} />
          <span className="mt-1.5 block h-2 w-1/2 rounded-full" style={{ background: preview.text, opacity: 0.2 }} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-5 flex-1 rounded-md" style={{ background: preview.primary }} />
          <span className="size-5 rounded-md" style={{ background: preview.accent }} />
        </div>
      </div>
    </div>
  )
}

/** Grid of selectable palette preview blocks. */
export function PalettePicker() {
  const { palette, setPalette, mode } = useTheme()

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {PALETTE_OPTIONS.map((opt) => {
        const active = palette === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setPalette(opt.value)}
            aria-pressed={active}
            className={cn(
              "group flex flex-col gap-3 rounded-xl border p-2.5 text-left transition-all",
              active
                ? "border-2 border-primary p-[9px]"
                : "border-border hover:border-foreground/30"
            )}
          >
            <PalettePreviewCard preview={mode === "dark" ? opt.previewDark : opt.preview} />
            <div className="flex items-center justify-between px-0.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{opt.label}</p>
                <p className="truncate text-xs text-muted-foreground">{opt.description}</p>
              </div>
              {active && <IconCheck className="size-4 shrink-0 text-primary" />}
            </div>
          </button>
        )
      })}
    </div>
  )
}
