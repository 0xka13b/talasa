import { useEffect, useRef, useState } from "react"
import { IconDots } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type ReportTab = { value: string; label: string }

// Matches the header nav tabs (rounded pill, muted label, accent hover) but
// keeps the underline active-state from the "line" tabs variant instead of
// the header's filled-background active state.
export const REPORT_TAB_CLASS =
  "h-auto flex-none rounded-[8px] px-3 py-2.5 text-sm font-normal text-muted-foreground hover:bg-accent/60"

const TABS_GAP_PX = 4 // gap-1

/** How many leading tabs fit in `containerWidth`, reserving room for the overflow trigger unless everything fits. */
function computeVisibleTabCount(
  containerWidth: number,
  itemWidths: number[],
  triggerWidth: number
) {
  if (containerWidth <= 0 || itemWidths.length === 0) return itemWidths.length
  const totalWidth =
    itemWidths.reduce((sum, w) => sum + w, 0) +
    TABS_GAP_PX * (itemWidths.length - 1)
  if (totalWidth <= containerWidth) return itemWidths.length

  let used = 0
  let count = 0
  for (let i = 0; i < itemWidths.length; i++) {
    const withGap = itemWidths[i] + (i > 0 ? TABS_GAP_PX : 0)
    const isLast = i === itemWidths.length - 1
    const reserve = isLast ? 0 : triggerWidth + TABS_GAP_PX
    if (used + withGap + reserve > containerWidth) break
    used += withGap
    count++
  }
  return Math.max(1, count)
}

/**
 * Report tabs collapse into a "more" dropdown once they no longer fit the
 * (now width-capped) hero column, instead of wrapping to a second row. Shared
 * by the vessel and counterparty-dd reports so both products get the same tab
 * behaviour.
 */
export function ReportTabsList({
  tabs,
  value,
  onValueChange,
}: {
  tabs: readonly ReportTab[]
  value: string
  onValueChange: (value: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const measureRefs = useRef<(HTMLDivElement | null)[]>([])
  const triggerMeasureRef = useRef<HTMLButtonElement>(null)
  const [visibleCount, setVisibleCount] = useState<number>(tabs.length)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const recompute = () => {
      const itemWidths = measureRefs.current.map((el) => el?.offsetWidth ?? 0)
      const triggerWidth = triggerMeasureRef.current?.offsetWidth ?? 0
      setVisibleCount(
        computeVisibleTabCount(container.offsetWidth, itemWidths, triggerWidth)
      )
    }

    recompute()
    const observer = new ResizeObserver(recompute)
    observer.observe(container)
    return () => observer.disconnect()
  }, [tabs.length])

  const overflowTabs = tabs.slice(visibleCount)
  const hasHiddenActive = overflowTabs.some((t) => t.value === value)

  return (
    <div
      ref={containerRef}
      className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden border-b border-border"
    >
      {/* Off-screen copy of every label, measured once to know real rendered widths. */}
      <div
        aria-hidden
        className="pointer-events-none invisible absolute top-0 left-0 flex gap-1"
      >
        {tabs.map((t, i) => (
          <div
            key={t.value}
            ref={(el) => {
              measureRefs.current[i] = el
            }}
            className={cn(REPORT_TAB_CLASS, "whitespace-nowrap")}
          >
            {t.label}
          </div>
        ))}
        <button ref={triggerMeasureRef} className="flex size-8" />
      </div>

      <TabsList
        variant="line"
        className="h-auto min-w-0 flex-none justify-start border-b-0"
      >
        {tabs.slice(0, visibleCount).map((t) => (
          <TabsTrigger key={t.value} value={t.value} className={REPORT_TAB_CLASS}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {overflowTabs.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="More tabs"
            className={cn(
              "flex size-8 flex-none shrink-0 cursor-pointer items-center justify-center rounded-[8px] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground",
              hasHiddenActive && "text-foreground"
            )}
          >
            <IconDots className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            {overflowTabs.map((t) => (
              <DropdownMenuItem
                key={t.value}
                onClick={() => onValueChange(t.value)}
                className={cn(value === t.value && "text-foreground font-medium")}
              >
                {t.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
