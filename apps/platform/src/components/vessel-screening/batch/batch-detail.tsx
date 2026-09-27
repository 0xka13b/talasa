import { useNavigate } from "@tanstack/react-router"
import { IconArchive } from "@tabler/icons-react"
import type { BatchStatusCounts } from "@talasa/shared"
import { Button } from "@/components/ui/button"
import { FullScreenSpinner } from "@/components/layout/full-screen-spinner"
import { cn } from "@/lib/utils"
import { useBatch, useArchiveBatch } from "@/hooks/use-batches"
import { ScreeningCard } from "../vessel-screening-card"

export function BatchDetail({ batchId }: { batchId: string }) {
  const { data: batch, isPending, isError } = useBatch(batchId)
  const archive = useArchiveBatch()
  const navigate = useNavigate()

  if (isPending) return <FullScreenSpinner />
  if (isError || !batch)
    return <p className="p-8 text-center text-sm text-muted-foreground">This batch no longer exists.</p>

  const c = batch.counts
  const done = c.completed + c.failed
  const pct = c.total > 0 ? Math.round((done / c.total) * 100) : 0

  async function remove() {
    if (!confirm(`Archive “${batch!.name}”? It will be hidden from the list and any monitor watching it will stop. Its ${c.total} screening${c.total === 1 ? "" : "s"} are kept.`)) return
    await archive.mutateAsync(batchId)
    navigate({ to: "/vessel-screening" })
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{batch.name}</h1>
          <p className="text-sm text-muted-foreground">
            {c.total} vessel{c.total === 1 ? "" : "s"} · {done} of {c.total} screened
            {c.failed > 0 ? ` · ${c.failed} failed` : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={remove} disabled={archive.isPending} className="gap-1.5">
          <IconArchive className="size-4" />
          Archive batch
        </Button>
      </div>

      {/* Aggregate progress */}
      <div className="flex flex-col gap-2">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
        <StatusLegend counts={c} />
      </div>

      {/* Members */}
      <div className="grid gap-2 sm:grid-cols-2">
        {batch.screenings.map((s) => (
          <ScreeningCard key={s.id} screening={s} />
        ))}
      </div>
    </div>
  )
}

function StatusLegend({ counts }: { counts: BatchStatusCounts }) {
  const items: { label: string; value: number; dot: string }[] = [
    { label: "completed", value: counts.completed, dot: "bg-emerald-500" },
    { label: "running", value: counts.running, dot: "bg-blue-500" },
    { label: "queued", value: counts.queued, dot: "bg-muted-foreground/50" },
    { label: "failed", value: counts.failed, dot: "bg-destructive" },
  ]
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", it.dot)} />
          {it.value} {it.label}
        </span>
      ))}
    </div>
  )
}
