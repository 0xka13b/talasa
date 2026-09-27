/**
 * Table-agnostic claim-loop harness. Extracted from run.ts so multiple
 * pipelines (counterparty `projects`, vessel `screenings`) share one set of
 * claim / lease / per-stage jsonb_set / progress primitives.
 */
import { sql } from "drizzle-orm"
import { createDb } from "@talasa/db"
import type { StageRecord } from "@talasa/shared"
import type { Logger } from "../log"
import type { Clients } from "../clients"

type Db = ReturnType<typeof createDb>
export type QueueTable = "projects" | "screenings"

export function resolveLeaseMinutes(raw: unknown): number {
  const n = Math.floor(Number(raw))
  return Number.isFinite(n) && n > 0 ? n : 10
}
export const LEASE_MINUTES = resolveLeaseMinutes(process.env.WORKER_LEASE_MINUTES)

export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try { return await fn() }
    catch (err) {
      lastErr = err
      if (attempt < maxAttempts) await sleep(200 * 2 ** (attempt - 1))
    }
  }
  throw lastErr
}

export async function setStage(db: Db, table: QueueTable, rowId: string, name: string, patch: Partial<StageRecord>) {
  await db.execute(sql`
    UPDATE ${sql.raw(table)}
    SET steps = jsonb_set(COALESCE(steps, '{}'::jsonb), ${sql.raw(`'{${name}}'`)}::text[], ${JSON.stringify(patch)}::jsonb, true),
        updated_at = now()
    WHERE id = ${rowId}
  `)
}

export async function setProgress(db: Db, table: QueueTable, rowId: string, done: number, total: number) {
  await db.execute(sql`
    UPDATE ${sql.raw(table)}
    SET progress = ${JSON.stringify({ done, total })}::jsonb, updated_at = now()
    WHERE id = ${rowId}
  `)
}

export interface RunStageCtx {
  db: Db
  table: QueueTable
  rowId: string
  stageLog: (stage: string) => any
  total: number
  doneCount: { value: number }
  failedBestEffort: string[]
  isDone: (name: string) => boolean
}

export function makeRunStage(ctx: RunStageCtx) {
  return async function runStage<T>(name: string, fn: () => Promise<T>, critical: boolean): Promise<T | null> {
    const { db, table, rowId, stageLog, total, doneCount, failedBestEffort, isDone } = ctx
    const sl = stageLog(name)

    if (isDone(name)) {
      sl.info("skipping — already done")
      doneCount.value++
      await setProgress(db, table, rowId, doneCount.value, total)
      return null
    }

    const startedAt = new Date().toISOString()
    sl.info("stage starting")
    await setStage(db, table, rowId, name, { status: "running", attempts: 0, startedAt })

    let attempts = 0
    const startMs = Date.now()
    try {
      const output = await withRetry(async () => { attempts++; return fn() })
      const finishedAt = new Date().toISOString()
      const durationMs = Date.now() - startMs
      await setStage(db, table, rowId, name, { status: "done", attempts, startedAt, finishedAt, durationMs, error: null, output })
      doneCount.value++
      await setProgress(db, table, rowId, doneCount.value, total)
      sl.info({ durationMs, attempts }, "stage done")
      return output
    } catch (err: unknown) {
      const finishedAt = new Date().toISOString()
      const durationMs = Date.now() - startMs
      const errMsg = err instanceof Error ? err.message : String(err)
      await setStage(db, table, rowId, name, { status: "failed", attempts, startedAt, finishedAt, durationMs, error: errMsg })
      sl.error({ err, attempts }, "stage failed")
      if (critical) {
        await db.execute(sql`UPDATE ${sql.raw(table)} SET status='failed', error=${errMsg}, updated_at=now() WHERE id=${rowId}`)
        throw err
      }
      failedBestEffort.push(name)
      doneCount.value++
      await setProgress(db, table, rowId, doneCount.value, total)
      return null
    }
  }
}

export async function claimRow(db: Db, table: QueueTable, returningColumns: string, leaseMinutes = LEASE_MINUTES): Promise<any | null> {
  const claimed = await db.execute(sql`
    UPDATE ${sql.raw(table)}
    SET status = 'running', started_at = now(), updated_at = now()
    WHERE id = (
      SELECT id FROM ${sql.raw(table)}
      WHERE status = 'queued'
         OR (status = 'running' AND started_at < now() - (${leaseMinutes} || ' minutes')::interval)
      ORDER BY updated_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING ${sql.raw(returningColumns)}
  `)
  if ((claimed as any).length === 0) return null
  return (claimed as any)[0]
}

export interface Pipeline {
  table: QueueTable
  /** SQL column list for the claim RETURNING clause. */
  returningColumns: string
  /** Orchestrate all stages for one claimed row and finalize it. */
  run(rawRow: any, c: Clients, log: Logger, db: Db): Promise<void>
}

/** Claim one queued/lease-expired row for the given pipeline and run it. */
export async function runQueue(pipeline: Pipeline, c: Clients, log: Logger, db: Db): Promise<boolean> {
  const leaseMinutes = resolveLeaseMinutes(process.env.WORKER_LEASE_MINUTES ?? LEASE_MINUTES)
  const raw = await claimRow(db, pipeline.table, pipeline.returningColumns, leaseMinutes)
  if (!raw) return false
  try {
    await pipeline.run(raw, c, log, db)
  } catch (err) {
    log.error({ err }, "pipeline failed")
  }
  return true
}
