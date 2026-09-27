/**
 * Monitor scheduler tick. Runs inside the same poll loop as the queues: claims
 * one DUE monitor (enabled + next_run_at in the past), creates a run, enqueues a
 * fresh `screenings` row per target vessel (tagged with the run so the vessel
 * pipeline routes it to the monitor path), and bumps the monitor's next run time.
 * The enqueued rows drain through the normal worker queue at the usual throttle.
 */
import { sql } from "drizzle-orm"
import { createDb } from "@talasa/db"
import { CADENCE_DAYS, type MonitorCadence } from "@talasa/shared"
import type { Logger } from "../log"

type Db = ReturnType<typeof createDb>

interface DueMonitor {
  id: string
  name: string
  target_kind: string
  imo: string | null
  batch_id: string | null
  cadence: string
  created_by: string
}

/** Atomically claim the next due monitor and push its next_run_at forward so it
 * cannot be double-claimed by a concurrent worker. */
async function claimDueMonitor(db: Db): Promise<DueMonitor | null> {
  const rows = (await db.execute(sql`
    UPDATE monitors
    SET updated_at = now()
    WHERE id = (
      SELECT id FROM monitors
      WHERE enabled = true AND archived = false AND next_run_at IS NOT NULL AND next_run_at <= now()
      ORDER BY next_run_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, name, target_kind, imo, batch_id, cadence, created_by
  `)) as any[]
  return (rows[0] as DueMonitor) ?? null
}

/** Distinct IMOs this monitor watches. */
async function targetImos(db: Db, m: DueMonitor): Promise<string[]> {
  if (m.target_kind === "batch" && m.batch_id) {
    const rows = (await db.execute(sql`
      SELECT DISTINCT imo FROM screenings WHERE batch_id = ${m.batch_id} AND imo IS NOT NULL
    `)) as any[]
    return rows.map((r) => r.imo as string)
  }
  return m.imo ? [m.imo] : []
}

/** Try to fire one due monitor. Returns true if a monitor was claimed (worked). */
export async function tickScheduler(log: Logger, db: Db): Promise<boolean> {
  const monitor = await claimDueMonitor(db)
  if (!monitor) return false

  const days = CADENCE_DAYS[monitor.cadence as MonitorCadence] ?? 1
  // Push the schedule forward first — even if enqueue below finds no targets, the
  // monitor should not re-fire on the very next tick.
  await db.execute(sql`UPDATE monitors SET next_run_at = now() + (${days} || ' days')::interval, updated_at = now() WHERE id = ${monitor.id}`)

  const imos = await targetImos(db, monitor)
  if (imos.length === 0) {
    log.warn({ monitorId: monitor.id }, "monitor has no target vessels — skipping run")
    return true
  }

  await db.transaction(async (tx) => {
    const runRows = (await tx.execute(sql`
      INSERT INTO monitor_runs (monitor_id, status, screening_count) VALUES (${monitor.id}, 'running', ${imos.length})
      RETURNING id
    `)) as any[]
    const runId = runRows[0].id as string
    for (const imo of imos) {
      await tx.execute(sql`
        INSERT INTO screenings (name, imo, status, created_by, monitor_id, monitor_run_id, steps)
        VALUES (${monitor.name}, ${imo}, 'queued', ${monitor.created_by}, ${monitor.id}, ${runId}, '{}'::jsonb)
      `)
    }
    log.info({ monitorId: monitor.id, runId, vessels: imos.length }, "monitor run enqueued")
  })

  return true
}
