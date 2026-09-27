import { Link, useNavigate } from "@tanstack/react-router"
import {
  IconRadar2, IconArchive, IconPlayerPlay, IconPlayerPause, IconCheck, IconAlertTriangle,
  IconClock, IconShip, IconStack2, IconChevronRight,
} from "@tabler/icons-react"
import type { MonitorChange, MonitorRun } from "@talasa/shared"
import { CHECK_LABELS } from "@talasa/shared"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FullScreenSpinner } from "@/components/layout/full-screen-spinner"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  useMonitor, useTriggerMonitor, useUpdateMonitor, useArchiveMonitor, useAcknowledgeChange, useAcknowledgeAll,
} from "@/hooks/use-monitors"

function fmt(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

const RUN_TONE: Record<MonitorRun["status"], string> = {
  running: "bg-blue-500",
  completed: "bg-emerald-500",
  failed: "bg-red-500",
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "primary" | "warn" }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border p-3">
      <span className={cn("text-2xl font-semibold tabular-nums", tone === "primary" && "text-primary", tone === "warn" && "text-amber-600 dark:text-amber-400")}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function ChangeCard({ change, onAck, ackPending }: { change: MonitorChange; onAck: () => void; ackPending: boolean }) {
  const acknowledged = change.acknowledgedAt != null
  return (
    <div className={cn("flex flex-col gap-2 rounded-lg border p-3", change.escalation && !acknowledged && "border-amber-500/40 bg-amber-500/5")}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <IconShip className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{change.vesselName ?? `IMO ${change.imo}`}</span>
            {change.escalation && (
              <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400">Escalation</Badge>
            )}
          </span>
          <span className="text-xs text-muted-foreground">{fmt(change.createdAt)}</span>
        </div>
        {acknowledged ? (
          <Badge variant="secondary" className="gap-1 text-[10px]"><IconCheck className="size-3" />Acknowledged</Badge>
        ) : (
          <Button variant="outline" size="xs" onClick={onAck} disabled={ackPending} className="gap-1">
            <IconCheck className="size-3" />Acknowledge
          </Button>
        )}
      </div>
      <ul className="flex flex-col gap-1">
        {change.changes.map((c, i) => (
          <li key={i} className="flex items-start gap-1.5 text-sm">
            <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", c.escalation ? "bg-amber-500" : "bg-muted-foreground/50")} />
            <span>{c.label}</span>
          </li>
        ))}
      </ul>
      {change.screeningId && (
        <Link to="/vessel-screening/$screeningId" params={{ screeningId: change.screeningId }} className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline">
          View updated report <IconChevronRight className="size-3" />
        </Link>
      )}
    </div>
  )
}

export function MonitorDetail({ monitorId }: { monitorId: string }) {
  const { data: m, isPending, isError } = useMonitor(monitorId)
  const trigger = useTriggerMonitor()
  const update = useUpdateMonitor(monitorId)
  const archive = useArchiveMonitor()
  const ack = useAcknowledgeChange()
  const ackAll = useAcknowledgeAll()
  const navigate = useNavigate()

  if (isPending) return <FullScreenSpinner />
  if (isError || !m) return <p className="p-8 text-center text-sm text-muted-foreground">Monitor not found.</p>

  const target = m.targetKind === "batch" ? `${m.vesselCount} vessels` : `IMO ${m.imo}`
  const unacked = (m.recentChanges as MonitorChange[]).filter((c) => c.acknowledgedAt == null)

  async function remove() {
    if (!confirm("Archive this monitor? Scheduled runs will stop and it will be hidden from the list. Its history is kept.")) return
    await archive.mutateAsync(monitorId)
    navigate({ to: "/vessel-screening" })
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <IconRadar2 className="size-5 text-primary" />
            <span className="truncate">{m.name}</span>
            {!m.enabled && <Badge variant="secondary">Paused</Badge>}
          </h1>
          <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            {m.targetKind === "batch" ? <IconStack2 className="size-3.5" /> : <IconShip className="size-3.5" />}
            {target}
            <span aria-hidden>·</span>
            <span className="capitalize">{m.cadence}</span> at {m.timeOfDay} UTC
            <span aria-hidden>·</span>
            {m.checks.map((c) => CHECK_LABELS[c]).join(", ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" disabled={trigger.isPending}
            onClick={() => trigger.mutate(monitorId, { onSuccess: () => toast.success("Re-check queued"), onError: () => toast.error("Couldn't trigger a run") })}>
            <IconPlayerPlay className="size-4" />Run now
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" disabled={update.isPending}
            onClick={() => update.mutate({ enabled: !m.enabled }, { onError: () => toast.error("Couldn't update the monitor") })}>
            {m.enabled ? <><IconPlayerPause className="size-4" />Pause</> : <><IconPlayerPlay className="size-4" />Resume</>}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={remove} disabled={archive.isPending}>
            <IconArchive className="size-4" />Archive
          </Button>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Vessels watched" value={m.vesselCount} />
        <Stat label="Unacknowledged" value={unacked.length} tone={unacked.length > 0 ? "warn" : undefined} />
        <Stat label={m.enabled ? "Next run" : "Status"} value={m.enabled ? fmt(m.nextRunAt) : "Paused"} />
        <Stat label="Last run" value={fmt(m.lastRunAt)} />
      </div>

      {/* change feed */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">Changes</h2>
          {unacked.length > 0 && (
            <Button variant="ghost" size="xs" className="gap-1" disabled={ackAll.isPending}
              onClick={() => ackAll.mutate(monitorId, { onSuccess: (r) => toast.success(`Acknowledged ${r.acknowledged}`) })}>
              <IconCheck className="size-3" />Acknowledge all
            </Button>
          )}
        </div>
        {m.recentChanges.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No changes detected yet. This monitor establishes a baseline on its first run and flags anything that moves after.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {m.recentChanges.map((c) => (
              <ChangeCard key={c.id} change={c} ackPending={ack.isPending} onAck={() => ack.mutate(c.id)} />
            ))}
          </div>
        )}
      </section>

      {/* run timeline */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">Evaluation history</h2>
        {m.runs.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No runs yet. The first evaluation runs on the schedule, or hit “Run now”.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {m.runs.map((run) => {
              const changed = run.changedCount > 0
              return (
                <li key={run.id} className={cn("flex items-center gap-3 rounded-lg border p-3", changed && "border-amber-500/40 bg-amber-500/5")}>
                  <span className={cn("size-2 shrink-0 rounded-full", RUN_TONE[run.status])} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2 text-sm">
                      {fmt(run.triggeredAt)}
                      {run.status === "running" && <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400">Running</Badge>}
                      {changed && (
                        <Badge className="gap-1 bg-amber-500/15 text-amber-600 dark:text-amber-400">
                          <IconAlertTriangle className="size-3" />
                          {run.changedCount} change{run.changedCount === 1 ? "" : "s"}
                        </Badge>
                      )}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <IconClock className="size-3" />
                      {run.screeningCount} vessel{run.screeningCount === 1 ? "" : "s"} evaluated
                      {run.status === "failed" ? " · failed" : ""}
                    </span>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}
