import { useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import {
  IconAlertTriangle,
  IconFileSpreadsheet,
  IconLoader2,
  IconUpload,
  IconX,
} from "@tabler/icons-react"
import { MAX_BATCH_VESSELS, type ParsedBatchFile } from "@talasa/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { readBatchFile } from "@/lib/batch-file"
import { useCreateBatch } from "@/hooks/use-batches"

/** How many parsed rows we render in the preview (the file may hold thousands). */
const PREVIEW_LIMIT = 200

type Loaded = { parsed: ParsedBatchFile; fileName: string }

export function BatchUpload() {
  const navigate = useNavigate()
  const create = useCreateBatch()
  const inputRef = useRef<HTMLInputElement>(null)
  const [reading, setReading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [name, setName] = useState("")

  async function handleFile(file: File | undefined) {
    if (!file) return
    setReading(true)
    setError(null)
    setLoaded(null)
    const res = await readBatchFile(file)
    setReading(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setLoaded({ parsed: res.parsed, fileName: res.fileName })
    // Seed the batch name from the file name (sans extension).
    setName(res.fileName.replace(/\.[^.]+$/, "").trim() || "Vessel batch")
  }

  function reset() {
    setLoaded(null)
    setError(null)
    setName("")
    if (inputRef.current) inputRef.current.value = ""
  }

  async function submit() {
    if (!loaded) return
    const vessels = loaded.parsed.vessels
      .slice(0, MAX_BATCH_VESSELS)
      .map((v) => ({ imo: v.imo, name: v.name }))
    try {
      const { id } = await create.mutateAsync({ name: name.trim() || "Vessel batch", vessels })
      navigate({ to: "/vessel-screening/batch/$batchId", params: { batchId: id } })
    } catch {
      toast.error("Couldn't start the batch")
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Screen a batch of vessels</h1>
        <p className="text-sm text-muted-foreground">
          Upload a CSV or Excel file — we read the IMO and vessel name from it (any
          column order), skip duplicates, and screen each vessel as a set.
        </p>
      </div>

      {/* Dropzone */}
      <label
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void handleFile(e.dataTransfer.files?.[0])
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center transition-colors",
          dragging ? "border-primary bg-accent/50" : "hover:border-primary/50 hover:bg-accent/30"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.tsv,.xlsx,.xls"
          className="sr-only"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        {reading ? (
          <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
        ) : (
          <IconUpload className="size-6 text-muted-foreground" />
        )}
        <span className="text-sm font-medium">
          {reading ? "Reading file…" : "Drop a CSV/Excel file, or click to browse"}
        </span>
        <span className="text-xs text-muted-foreground">.csv, .xlsx or .xls · up to 15 MB</span>
      </label>

      {/* Parse failure — say exactly why */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
          <IconAlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium text-destructive">Couldn't use this file</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {loaded && <BatchPreview loaded={loaded} name={name} onName={setName} onReset={reset} onSubmit={submit} submitting={create.isPending} />}
    </div>
  )
}

function BatchPreview({
  loaded,
  name,
  onName,
  onReset,
  onSubmit,
  submitting,
}: {
  loaded: Loaded
  name: string
  onName: (v: string) => void
  onReset: () => void
  onSubmit: () => void
  submitting: boolean
}) {
  const { parsed, fileName } = loaded
  const total = parsed.vessels.length
  const willScreen = Math.min(total, MAX_BATCH_VESSELS)
  const capped = total > MAX_BATCH_VESSELS
  const shown = parsed.vessels.slice(0, PREVIEW_LIMIT)

  return (
    <div className="flex flex-col gap-4">
      {/* File + reset */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <IconFileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium">{fileName}</span>
          {parsed.imoHeader && (
            <span className="shrink-0 text-xs text-muted-foreground">
              IMO ← “{parsed.imoHeader}”{parsed.nameHeader ? ` · name ← “${parsed.nameHeader}”` : ""}
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onReset} className="shrink-0 gap-1">
          <IconX className="size-4" />
          Choose another
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Will screen" value={willScreen} tone="primary" />
        <Stat label="Duplicates skipped" value={parsed.duplicateCount} />
        <Stat label="Names defaulted" value={parsed.nameMissingCount} tone={parsed.nameMissingCount > 0 ? "warn" : undefined} />
        <Stat label="Unreadable rows" value={parsed.invalidCount} tone={parsed.invalidCount > 0 ? "danger" : undefined} />
      </div>

      {capped && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <IconAlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-muted-foreground">
            This file has <span className="font-medium">{total.toLocaleString()}</span> unique vessels. A batch is
            limited to <span className="font-medium">{MAX_BATCH_VESSELS}</span> — only the first{" "}
            {MAX_BATCH_VESSELS} will be screened. Split the file to screen the rest.
          </p>
        </div>
      )}

      {/* Batch name */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="batch-name">Batch name</Label>
        <Input id="batch-name" value={name} onChange={(e) => onName(e.target.value)} placeholder="e.g. Q3 shadow-fleet watchlist" />
      </div>

      {/* Parsed vessels */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">
          Parsed vessels{" "}
          <span className="text-muted-foreground">
            (showing {Math.min(shown.length, willScreen)} of {willScreen})
          </span>
        </p>
        <div className="max-h-80 overflow-y-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-muted/60 text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">IMO</th>
                <th className="px-3 py-2 font-medium">Name</th>
              </tr>
            </thead>
            <tbody>
              {shown.slice(0, willScreen).map((v, i) => (
                <tr key={v.imo} className="border-t">
                  <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-1.5 font-mono tabular-nums">{v.imo}</td>
                  <td className="px-3 py-1.5">
                    {v.nameMissing ? (
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        {v.name}
                        <Badge className="bg-amber-500/15 text-[10px] text-amber-600 dark:text-amber-400">
                          name missing
                        </Badge>
                      </span>
                    ) : (
                      v.name
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unreadable rows — show WHERE the IMOs/names are missing */}
      {parsed.invalidSamples.length > 0 && (
        <details className="rounded-lg border border-destructive/30">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-destructive">
            {parsed.invalidCount} row{parsed.invalidCount === 1 ? "" : "s"} skipped — no valid IMO
            {parsed.invalidCount > parsed.invalidSamples.length ? ` (first ${parsed.invalidSamples.length} shown)` : ""}
          </summary>
          <div className="max-h-56 overflow-y-auto border-t">
            <table className="w-full text-left text-sm">
              <thead className="text-xs tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2 font-medium">Line</th>
                  <th className="px-3 py-2 font-medium">IMO value</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {parsed.invalidSamples.map((r) => (
                  <tr key={r.line} className="border-t">
                    <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{r.line}</td>
                    <td className="px-3 py-1.5 font-mono">{r.rawImo || <span className="text-muted-foreground italic">empty</span>}</td>
                    <td className="px-3 py-1.5">{r.rawName || <span className="text-muted-foreground italic">—</span>}</td>
                    <td className="px-3 py-1.5 text-destructive">{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <Button onClick={onSubmit} disabled={submitting || willScreen === 0} className="self-start">
        {submitting ? "Starting…" : `Screen ${willScreen} vessel${willScreen === 1 ? "" : "s"}`}
      </Button>
    </div>
  )
}

const TONE_CLASS: Record<string, string> = {
  primary: "text-primary",
  warn: "text-amber-600 dark:text-amber-400",
  danger: "text-destructive",
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "primary" | "warn" | "danger" }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border p-3">
      <span className={cn("text-2xl font-semibold tabular-nums", tone && TONE_CLASS[tone])}>
        {value.toLocaleString()}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}
