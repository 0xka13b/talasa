import { and, desc, eq, sql } from "drizzle-orm"
import {
  CADENCE_DAYS, buildWatchSnapshot,
  type CreateMonitorInput, type UpdateMonitorInput, type MonitorCadence,
  type MonitorSummary, type MonitorDetail, type MonitorRun, type MonitorChange,
  type MonitorCheck, type MonitorNotifyMode, type MonitorTargetKind,
  type VesselBrief, type WatchChange,
} from "@talasa/shared"
import { db, monitors, monitorRuns, monitorChanges, screenings, batches } from "@talasa/db"

type MonitorRow = typeof monitors.$inferSelect

/** First scheduled run: one cadence period out, at the configured UTC time. */
function computeNextRunAt(cadence: MonitorCadence, timeOfDay: string): Date {
  const [hh, mm] = timeOfDay.split(":").map(Number)
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + (CADENCE_DAYS[cadence] ?? 1))
  d.setUTCHours(hh ?? 6, mm ?? 0, 0, 0)
  return d
}

/** Distinct vessels a monitor watches (1 for a vessel monitor). */
async function vesselCount(monitor: Pick<MonitorRow, "targetKind" | "batchId">): Promise<number> {
  if (monitor.targetKind === "batch" && monitor.batchId) {
    const [r] = await db
      .select({ n: sql<number>`count(distinct ${screenings.imo})::int` })
      .from(screenings)
      .where(eq(screenings.batchId, monitor.batchId))
    return r?.n ?? 0
  }
  return 1
}

async function toSummary(m: MonitorRow, unacknowledged: number): Promise<MonitorSummary> {
  return {
    id: m.id,
    name: m.name,
    targetKind: m.targetKind as MonitorTargetKind,
    imo: m.imo,
    batchId: m.batchId,
    vesselCount: await vesselCount(m),
    cadence: m.cadence as MonitorCadence,
    timeOfDay: m.timeOfDay,
    checks: m.checks as MonitorCheck[],
    notifyMode: m.notifyMode as MonitorNotifyMode,
    enabled: m.enabled,
    archived: m.archived,
    nextRunAt: m.nextRunAt ? m.nextRunAt.toISOString() : null,
    lastRunAt: m.lastRunAt ? m.lastRunAt.toISOString() : null,
    unacknowledgedChanges: unacknowledged,
    createdBy: m.createdBy,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  }
}

/** Unacknowledged change counts keyed by monitor id. */
async function unackByMonitor(monitorIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (monitorIds.length === 0) return map
  const rows = await db
    .select({ monitorId: monitorChanges.monitorId, n: sql<number>`count(*)::int` })
    .from(monitorChanges)
    .where(and(sql`${monitorChanges.monitorId} in ${monitorIds}`, sql`${monitorChanges.acknowledgedAt} is null`))
    .groupBy(monitorChanges.monitorId)
  for (const r of rows) map.set(r.monitorId, r.n)
  return map
}

export async function listMonitors(userId: string): Promise<MonitorSummary[]> {
  // Archived monitors are retained but excluded from the active list.
  const rows = await db.select().from(monitors).where(and(eq(monitors.createdBy, userId), eq(monitors.archived, false))).orderBy(desc(monitors.createdAt))
  const unack = await unackByMonitor(rows.map((m) => m.id))
  return Promise.all(rows.map((m) => toSummary(m, unack.get(m.id) ?? 0)))
}

/**
 * Backfill a watch snapshot onto the latest completed screening for each target
 * vessel that lacks one, so the monitor's FIRST run has a baseline to diff
 * against (screenings created before monitoring have no watch_snapshot).
 */
async function backfillBaselineSnapshots(userId: string, imos: string[]): Promise<void> {
  for (const imo of imos) {
    const [row] = await db
      .select({ id: screenings.id, brief: screenings.brief, watchSnapshot: screenings.watchSnapshot })
      .from(screenings)
      .where(and(eq(screenings.createdBy, userId), eq(screenings.imo, imo), eq(screenings.status, "completed")))
      .orderBy(desc(screenings.finishedAt))
      .limit(1)
    if (!row || row.watchSnapshot || !row.brief) continue
    const snap = buildWatchSnapshot(row.brief as VesselBrief)
    await db.update(screenings).set({ watchSnapshot: snap }).where(eq(screenings.id, row.id))
  }
}

/** Distinct IMOs a create request targets (for baseline backfill). */
async function targetImos(userId: string, input: CreateMonitorInput): Promise<string[]> {
  if (input.targetKind === "batch" && input.batchId) {
    const rows = await db
      .selectDistinct({ imo: screenings.imo })
      .from(screenings)
      .where(and(eq(screenings.batchId, input.batchId), eq(screenings.createdBy, userId)))
    return rows.map((r) => r.imo)
  }
  return input.imo ? [input.imo] : []
}

export async function createMonitor(userId: string, input: CreateMonitorInput): Promise<{ id: string } | { error: string }> {
  // A batch monitor must point at a batch the user owns.
  if (input.targetKind === "batch") {
    const [batch] = await db.select({ id: batches.id }).from(batches).where(and(eq(batches.id, input.batchId!), eq(batches.createdBy, userId)))
    if (!batch) return { error: "Batch not found" }
  }
  const nextRunAt = computeNextRunAt(input.cadence, input.timeOfDay)
  const [row] = await db
    .insert(monitors)
    .values({
      name: input.name,
      targetKind: input.targetKind,
      imo: input.targetKind === "vessel" ? input.imo : null,
      batchId: input.targetKind === "batch" ? input.batchId : null,
      cadence: input.cadence,
      timeOfDay: input.timeOfDay,
      checks: input.checks,
      notifyMode: input.notifyMode,
      createdBy: userId,
      nextRunAt,
    })
    .returning({ id: monitors.id })
  if (!row) throw new Error("Insert did not return a monitor")
  await backfillBaselineSnapshots(userId, await targetImos(userId, input))
  return { id: row.id }
}

async function loadOwned(userId: string, id: string): Promise<MonitorRow | null> {
  const [m] = await db.select().from(monitors).where(and(eq(monitors.id, id), eq(monitors.createdBy, userId)))
  return m ?? null
}

function toRun(r: typeof monitorRuns.$inferSelect): MonitorRun {
  return {
    id: r.id,
    monitorId: r.monitorId,
    status: r.status as MonitorRun["status"],
    screeningCount: r.screeningCount,
    changedCount: r.changedCount,
    triggeredAt: r.triggeredAt.toISOString(),
    finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
  }
}

function toChange(r: typeof monitorChanges.$inferSelect): MonitorChange {
  return {
    id: r.id,
    monitorId: r.monitorId,
    monitorRunId: r.monitorRunId,
    imo: r.imo,
    vesselName: r.vesselName,
    screeningId: r.screeningId ?? "",
    previousScreeningId: r.previousScreeningId,
    changes: (r.changes ?? []) as WatchChange[],
    escalation: r.escalation,
    acknowledgedAt: r.acknowledgedAt ? r.acknowledgedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }
}

/** Recent changes across all of a user's monitors — powers the change feed/badge. */
export async function listChanges(userId: string, opts: { unacknowledgedOnly?: boolean; limit?: number } = {}): Promise<MonitorChange[]> {
  const conds = [eq(monitors.createdBy, userId)]
  if (opts.unacknowledgedOnly) conds.push(sql`${monitorChanges.acknowledgedAt} is null`)
  const rows = await db
    .select({ c: monitorChanges })
    .from(monitorChanges)
    .innerJoin(monitors, eq(monitors.id, monitorChanges.monitorId))
    .where(and(...conds))
    .orderBy(desc(monitorChanges.createdAt))
    .limit(opts.limit ?? 100)
  return rows.map((r) => toChange(r.c))
}

export async function getMonitor(userId: string, id: string): Promise<MonitorDetail | null> {
  const m = await loadOwned(userId, id)
  if (!m) return null
  const unack = await unackByMonitor([id])
  const summary = await toSummary(m, unack.get(id) ?? 0)
  const runs = await db.select().from(monitorRuns).where(eq(monitorRuns.monitorId, id)).orderBy(desc(monitorRuns.triggeredAt)).limit(50)
  const changes = await db.select().from(monitorChanges).where(eq(monitorChanges.monitorId, id)).orderBy(desc(monitorChanges.createdAt)).limit(100)
  return { ...summary, runs: runs.map(toRun), recentChanges: changes.map(toChange) }
}

export async function updateMonitor(userId: string, id: string, patch: UpdateMonitorInput): Promise<MonitorSummary | null> {
  const m = await loadOwned(userId, id)
  if (!m) return null
  const cadence = patch.cadence ?? (m.cadence as MonitorCadence)
  const timeOfDay = patch.timeOfDay ?? m.timeOfDay
  const set: Partial<MonitorRow> = { updatedAt: new Date() }
  if (patch.name !== undefined) set.name = patch.name
  if (patch.checks !== undefined) set.checks = patch.checks
  if (patch.notifyMode !== undefined) set.notifyMode = patch.notifyMode
  if (patch.enabled !== undefined) set.enabled = patch.enabled
  if (patch.cadence !== undefined || patch.timeOfDay !== undefined) {
    set.cadence = cadence
    set.timeOfDay = timeOfDay
    // Reschedule from now under the new cadence (unless disabled).
    set.nextRunAt = (patch.enabled ?? m.enabled) ? computeNextRunAt(cadence, timeOfDay) : m.nextRunAt
  }
  if (patch.enabled === false) set.nextRunAt = null
  if (patch.enabled === true && !m.nextRunAt) set.nextRunAt = computeNextRunAt(cadence, timeOfDay)
  const [row] = await db.update(monitors).set(set).where(and(eq(monitors.id, id), eq(monitors.createdBy, userId))).returning()
  if (!row) return null
  const unack = await unackByMonitor([id])
  return toSummary(row, unack.get(id) ?? 0)
}

/** Fire a monitor on the next scheduler tick (demo / on-demand re-check). */
export async function triggerMonitor(userId: string, id: string): Promise<boolean> {
  const [row] = await db
    .update(monitors)
    .set({ nextRunAt: new Date(), enabled: true, updatedAt: new Date() })
    .where(and(eq(monitors.id, id), eq(monitors.createdBy, userId), eq(monitors.archived, false)))
    .returning({ id: monitors.id })
  return Boolean(row)
}

export async function deleteMonitor(userId: string, id: string): Promise<boolean> {
  const [row] = await db.delete(monitors).where(and(eq(monitors.id, id), eq(monitors.createdBy, userId))).returning({ id: monitors.id })
  return Boolean(row)
}

/**
 * Soft-archive a monitor: hide it from the active list AND stop all future
 * scheduled runs. Setting enabled=false + nextRunAt=null makes the scheduler's
 * claim predicate (enabled AND next_run_at <= now) skip it; the archived flag is
 * a redundant guard also filtered in the scheduler query.
 */
export async function archiveMonitor(userId: string, id: string): Promise<boolean> {
  const [row] = await db
    .update(monitors)
    .set({ archived: true, enabled: false, nextRunAt: null, updatedAt: new Date() })
    .where(and(eq(monitors.id, id), eq(monitors.createdBy, userId)))
    .returning({ id: monitors.id })
  return Boolean(row)
}

/** Acknowledge one change (scoped to a monitor the user owns). */
export async function acknowledgeChange(userId: string, changeId: string): Promise<boolean> {
  const rows = (await db.execute(sql`
    UPDATE monitor_changes SET acknowledged_at = now()
    WHERE id = ${changeId}
      AND acknowledged_at IS NULL
      AND monitor_id IN (SELECT id FROM monitors WHERE created_by = ${userId})
    RETURNING id
  `)) as any[]
  return rows.length > 0
}

/** Acknowledge every outstanding change for a monitor the user owns. */
export async function acknowledgeAll(userId: string, monitorId: string): Promise<number> {
  const rows = (await db.execute(sql`
    UPDATE monitor_changes SET acknowledged_at = now()
    WHERE monitor_id = ${monitorId}
      AND acknowledged_at IS NULL
      AND monitor_id IN (SELECT id FROM monitors WHERE created_by = ${userId})
    RETURNING id
  `)) as any[]
  return rows.length
}
