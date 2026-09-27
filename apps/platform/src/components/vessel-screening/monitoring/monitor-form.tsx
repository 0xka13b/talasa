import { useState } from "react"
import { IconRadar2, IconArrowLeft, IconArrowRight, IconCheck } from "@tabler/icons-react"
import {
  MONITOR_CADENCES, MONITOR_CHECKS, MONITOR_NOTIFY_MODES, CHECK_LABELS,
  type MonitorCadence, type MonitorCheck, type MonitorNotifyMode, type CreateMonitorInput,
} from "@talasa/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCreateMonitor } from "@/hooks/use-monitors"
import { useBatches } from "@/hooks/use-batches"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const NOTIFY_LABELS: Record<MonitorNotifyMode, string> = {
  all_changes: "All changes",
  escalations_only: "Escalations only",
}

const STEPS = ["Target", "Checks", "Schedule", "Review"] as const
const LAST = STEPS.length - 1

/** A target the form should pre-fill and lock (e.g. from a vessel's report). */
export type LockedTarget =
  | { kind: "vessel"; imo: string; name?: string | null }
  | { kind: "batch"; batchId: string; name?: string | null }

function Segmented<T extends string>({ options, value, onChange, labels }: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  labels?: Record<T, string>
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <Button key={o} type="button" size="sm" variant={value === o ? "default" : "outline"} onClick={() => onChange(o)} className="capitalize">
          {labels?.[o] ?? o}
        </Button>
      ))}
    </div>
  )
}

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums transition-colors",
              i < step && "border-primary bg-primary text-primary-foreground",
              i === step && "border-primary text-primary",
              i > step && "border-muted-foreground/30 text-muted-foreground",
            )}>
              {i < step ? <IconCheck className="size-3.5" /> : i + 1}
            </span>
            <span className={cn("hidden text-sm sm:inline", i === step ? "font-medium" : "text-muted-foreground")}>{label}</span>
          </div>
          {i < LAST && <div className={cn("mx-2 h-px w-4 sm:w-8", i < step ? "bg-primary" : "bg-border")} />}
        </div>
      ))}
    </div>
  )
}

function ReviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{children}</span>
    </div>
  )
}

/**
 * Create a recurring monitor as a short wizard (Target → Checks → Schedule →
 * Review) so no single screen is crowded. Target can be a single vessel (IMO) or
 * one of the user's batches; `lockedTarget` pre-fills + locks it (used from a
 * report). The checks the user picks are the ONLY stages re-run each cycle.
 */
export function MonitorForm({ lockedTarget, onCreated }: { lockedTarget?: LockedTarget; onCreated?: (id: string) => void }) {
  const create = useCreateMonitor()
  const { data: batches } = useBatches()

  const [step, setStep] = useState(0)
  const [name, setName] = useState(lockedTarget?.name ? `Monitor — ${lockedTarget.name}` : "")
  const [targetKind, setTargetKind] = useState<"vessel" | "batch">(lockedTarget?.kind ?? "vessel")
  const [imo, setImo] = useState(lockedTarget?.kind === "vessel" ? lockedTarget.imo : "")
  const [batchId, setBatchId] = useState(lockedTarget?.kind === "batch" ? lockedTarget.batchId : "")
  const [cadence, setCadence] = useState<MonitorCadence>("daily")
  const [timeOfDay, setTimeOfDay] = useState("06:00")
  const [checks, setChecks] = useState<Set<MonitorCheck>>(new Set(["sanctions"]))
  const [notifyMode, setNotifyMode] = useState<MonitorNotifyMode>("all_changes")

  const locked = !!lockedTarget
  const sanctionsOnly = checks.size === 1 && checks.has("sanctions")
  const pickedBatch = (batches ?? []).find((b) => b.id === batchId)
  const targetLabel =
    targetKind === "batch"
      ? pickedBatch ? `${pickedBatch.name} (${pickedBatch.counts.total} vessels)` : "a batch"
      : `IMO ${imo || "—"}`

  function toggleCheck(c: MonitorCheck) {
    setChecks((prev) => {
      const next = new Set(prev)
      next.has(c) ? next.delete(c) : next.add(c)
      if (next.size === 0) next.add(c) // never empty
      return next
    })
  }

  /** Validate the current step; returns false + toasts on a problem. */
  function validateStep(): boolean {
    if (step === 0) {
      if (!name.trim()) return toast.error("Give the monitor a name"), false
      if (!locked && targetKind === "vessel" && !/^\d{7}$/.test(imo)) return toast.error("Enter a 7-digit IMO"), false
      if (!locked && targetKind === "batch" && !batchId) return toast.error("Pick a batch to monitor"), false
    }
    return true
  }

  async function createMonitor() {
    const input: CreateMonitorInput = {
      name: name.trim(),
      targetKind,
      imo: targetKind === "vessel" ? imo : undefined,
      batchId: targetKind === "batch" ? batchId : undefined,
      cadence,
      timeOfDay,
      checks: [...checks],
      notifyMode,
    }
    try {
      const { id } = await create.mutateAsync(input)
      toast.success("Monitor created")
      onCreated?.(id)
    } catch {
      toast.error("Couldn't create the monitor")
    }
  }

  // The primary button is always the form's submit: it advances a step, or
  // creates on the last one — so Enter does the natural thing too.
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateStep()) return
    if (step < LAST) return setStep(step + 1)
    void createMonitor()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <StepIndicator step={step} />

      {step === 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="monitor-name">Name</Label>
            <Input id="monitor-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sanctions watch — MV Neptune" autoFocus />
          </div>
          {locked ? (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              Watching{" "}
              <span className="font-medium">{lockedTarget!.kind === "vessel" ? `IMO ${lockedTarget!.imo}` : "the selected batch"}</span>
              {lockedTarget!.name ? ` · ${lockedTarget!.name}` : ""}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label>Watch</Label>
              <Segmented options={["vessel", "batch"] as const} value={targetKind} onChange={setTargetKind} labels={{ vessel: "Single vessel", batch: "A batch" }} />
              {targetKind === "vessel" ? (
                <Input value={imo} onChange={(e) => setImo(e.target.value.replace(/\D/g, "").slice(0, 7))} placeholder="7-digit IMO" inputMode="numeric" className="mt-1.5 max-w-52" />
              ) : (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {(batches ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No batches yet — upload one first.</p>
                  ) : (
                    (batches ?? []).map((b) => (
                      <Button key={b.id} type="button" size="sm" variant={batchId === b.id ? "default" : "outline"} onClick={() => setBatchId(b.id)}>
                        {b.name} · {b.counts.total}
                      </Button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-1.5">
          <Label>Checks to re-run &amp; compare</Label>
          <div className="flex flex-wrap gap-1.5">
            {MONITOR_CHECKS.map((c) => (
              <Button key={c} type="button" size="sm" variant={checks.has(c) ? "default" : "outline"} onClick={() => toggleCheck(c)}>
                {CHECK_LABELS[c]}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {sanctionsOnly
              ? "A sanctions-only re-check reuses the last screening's vessel data — no registry calls, just a fresh sanctions comparison."
              : "Only the selected checks are re-run each cycle; everything else is reused from the last run."}
          </p>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>How often</Label>
              <Segmented options={MONITOR_CADENCES} value={cadence} onChange={setCadence} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="monitor-time">Time (UTC)</Label>
              <Input id="monitor-time" type="time" value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} className="max-w-32" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Notify me on</Label>
            <Segmented options={MONITOR_NOTIFY_MODES} value={notifyMode} onChange={setNotifyMode} labels={NOTIFY_LABELS} />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-1.5">
          <Label>Review</Label>
          <div className="rounded-lg border p-3">
            <ReviewRow label="Name">{name || "—"}</ReviewRow>
            <ReviewRow label="Watching">{targetLabel}</ReviewRow>
            <ReviewRow label="Checks">{[...checks].map((c) => CHECK_LABELS[c]).join(", ")}</ReviewRow>
            <ReviewRow label="Schedule"><span className="capitalize">{cadence}</span> at {timeOfDay} UTC</ReviewRow>
            <ReviewRow label="Notify on">{NOTIFY_LABELS[notifyMode]}</ReviewRow>
          </div>
        </div>
      )}

      {/* nav */}
      <div className="flex items-center justify-between pt-1">
        <Button type="button" variant="ghost" size="sm" className="gap-1.5" disabled={step === 0} onClick={() => setStep(step - 1)}>
          <IconArrowLeft className="size-4" />
          Back
        </Button>
        {step < LAST ? (
          <Button type="submit" size="sm" className="gap-1.5">
            Next
            <IconArrowRight className="size-4" />
          </Button>
        ) : (
          <Button type="submit" size="sm" className="gap-1.5" disabled={create.isPending}>
            <IconRadar2 className="size-4" />
            {create.isPending ? "Creating…" : "Create monitor"}
          </Button>
        )}
      </div>
    </form>
  )
}
