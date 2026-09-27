import { and, desc, eq, inArray, sql } from "drizzle-orm"
import type { BatchStatusCounts, BatchSummary, CreateBatchInput } from "@talasa/shared"
import { db, batches, screenings, monitors } from "@talasa/db"

function emptyCounts(): BatchStatusCounts {
  return { total: 0, queued: 0, running: 0, completed: 0, failed: 0 }
}

/** Roll member screenings up into per-status counts keyed by batch id. */
async function countsByBatch(userId: string, batchIds: string[]): Promise<Map<string, BatchStatusCounts>> {
  const map = new Map<string, BatchStatusCounts>()
  if (batchIds.length === 0) return map
  const rows = await db
    .select({ batchId: screenings.batchId, status: screenings.status, n: sql<number>`count(*)::int` })
    .from(screenings)
    .where(and(eq(screenings.createdBy, userId), inArray(screenings.batchId, batchIds)))
    .groupBy(screenings.batchId, screenings.status)
  for (const r of rows) {
    if (!r.batchId) continue
    const c = map.get(r.batchId) ?? emptyCounts()
    c.total += r.n
    // draft members (shouldn't occur — batch members enqueue immediately) fold into no bucket beyond total.
    if (r.status === "queued" || r.status === "running" || r.status === "completed" || r.status === "failed") {
      c[r.status] += r.n
    }
    map.set(r.batchId, c)
  }
  return map
}

function toSummary(batch: typeof batches.$inferSelect, counts: BatchStatusCounts): BatchSummary {
  return {
    id: batch.id,
    name: batch.name,
    counts,
    archived: batch.archived,
    createdBy: batch.createdBy,
    createdAt: batch.createdAt.toISOString(),
    updatedAt: batch.updatedAt.toISOString(),
  }
}

export async function listBatches(userId: string): Promise<BatchSummary[]> {
  // Archived batches are retained but excluded from the active list.
  const rows = await db.select().from(batches).where(and(eq(batches.createdBy, userId), eq(batches.archived, false))).orderBy(desc(batches.createdAt))
  const counts = await countsByBatch(userId, rows.map((b) => b.id))
  return rows.map((b) => toSummary(b, counts.get(b.id) ?? emptyCounts()))
}

/**
 * Create a batch and enqueue one screening per vessel. Batch members are inserted
 * straight to `status='queued'` (unlike the two-step create→run for a single
 * screening), so the existing worker poll-loop picks each one up independently.
 */
export async function createBatch(userId: string, input: CreateBatchInput): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const [batch] = await tx.insert(batches).values({ name: input.name, createdBy: userId }).returning({ id: batches.id })
    if (!batch) throw new Error("Insert did not return a batch")
    await tx.insert(screenings).values(
      input.vessels.map((v) => ({ name: v.name, imo: v.imo, batchId: batch.id, createdBy: userId, status: "queued" as const })),
    )
    return { id: batch.id }
  })
}

export async function getBatch(userId: string, id: string) {
  const [batch] = await db.select().from(batches).where(and(eq(batches.id, id), eq(batches.createdBy, userId)))
  if (!batch) return null
  const members = await db
    .select()
    .from(screenings)
    .where(and(eq(screenings.batchId, id), eq(screenings.createdBy, userId)))
    .orderBy(desc(screenings.createdAt))
  const counts = await countsByBatch(userId, [id])
  return { ...toSummary(batch, counts.get(id) ?? emptyCounts()), screenings: members }
}

/** Delete a batch; the FK cascade removes its member screenings. */
export async function deleteBatch(userId: string, id: string): Promise<boolean> {
  const [row] = await db.delete(batches).where(and(eq(batches.id, id), eq(batches.createdBy, userId))).returning({ id: batches.id })
  return Boolean(row)
}

/**
 * Soft-archive a batch: hide it from the active list (members are retained) AND
 * stop any monitor targeting this batch, so scheduled re-screening halts. The
 * monitor is archived + disabled + unscheduled, matching archiveMonitor.
 */
export async function archiveBatch(userId: string, id: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(batches)
      .set({ archived: true, updatedAt: new Date() })
      .where(and(eq(batches.id, id), eq(batches.createdBy, userId)))
      .returning({ id: batches.id })
    if (!row) return false
    // Halt scheduled re-screening for any monitor watching this batch.
    await tx
      .update(monitors)
      .set({ archived: true, enabled: false, nextRunAt: null, updatedAt: new Date() })
      .where(and(eq(monitors.batchId, id), eq(monitors.createdBy, userId)))
    return true
  })
}
