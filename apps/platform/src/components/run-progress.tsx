import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

/**
 * Generic, module-agnostic progress view shown while a long-running job (vessel
 * screening, counterparty DD) is in flight. It deliberately shows only an
 * overall percentage and a rotating set of neutral status phrases — never the
 * underlying pipeline stages — so the product surface doesn't leak how the work
 * is actually decomposed.
 */

const PHASES = [
  "Gathering records",
  "Mapping connections",
  "Cross-checking signals",
  "Weighing the evidence",
  "Assembling the report",
]

export function RunProgress({
  label,
  done,
  total,
  bare = false,
}: {
  label: string
  done: number
  total: number
  bare?: boolean
}) {
  const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((done / total) * 100))) : 0

  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setPhase((p) => (p + 1) % PHASES.length), 2400)
    return () => clearInterval(id)
  }, [])

  const r = 52
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - pct / 100)

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "flex flex-col items-center justify-center gap-8 overflow-hidden px-6 py-16",
        bare ? "min-h-[60vh]" : "bg-card/40 rounded-xl border"
      )}
    >
      <div className="relative flex items-center justify-center">
        {/* Sonar pings — ambient motion so it feels alive between polls. */}
        <span
          className="border-primary/15 animate-ping absolute size-44 rounded-full border"
          style={{ animationDuration: "2.8s" }}
        />
        <span
          className="border-primary/10 animate-ping absolute size-44 rounded-full border"
          style={{ animationDuration: "2.8s", animationDelay: "1.4s" }}
        />

        {/* Slow radar sweep behind the dial. */}
        <div
          className="animate-spin text-primary absolute size-40 rounded-full opacity-[0.12]"
          style={{
            animationDuration: "3.2s",
            background:
              "conic-gradient(from 0deg, transparent 0deg, transparent 250deg, currentColor 360deg)",
          }}
        />

        {/* Determinate progress dial. */}
        <svg viewBox="0 0 120 120" className="size-40 -rotate-90">
          <circle cx="60" cy="60" r={r} strokeWidth="3" className="stroke-muted fill-none" />
          <circle
            cx="60"
            cy="60"
            r={r}
            strokeWidth="3"
            strokeLinecap="round"
            className="stroke-primary fill-none transition-[stroke-dashoffset] duration-700 ease-out"
            style={{ strokeDasharray: circumference, strokeDashoffset: offset }}
          />
        </svg>

        <div className="absolute flex items-baseline">
          <span className="text-4xl font-light tabular-nums">{pct}</span>
          <span className="text-muted-foreground text-lg">%</span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1.5 text-center">
        <p className="text-sm font-medium">{label}</p>
        <p key={phase} className="text-muted-foreground animate-in fade-in text-xs">
          {PHASES[phase]}…
        </p>
      </div>
    </div>
  )
}
