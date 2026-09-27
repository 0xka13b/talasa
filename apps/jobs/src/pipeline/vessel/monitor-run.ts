import { sql } from "drizzle-orm"
import { createDb } from "@talasa/db"
import {
  VESSEL_STAGE_NAMES, emptyAisBehavior, buildWatchSnapshot, hashSnapshot, diffSnapshots,
  stagesForChecks, facetsForChecks,
  type AisBehavior, type InferredOwnership, type MonitorCheck, type MonitorNotifyMode,
  type StageRecord, type VesselBrief, type VesselHistory, type VesselInspections, type WatchSnapshot,
} from "@talasa/shared"
import type { Logger } from "../../log"
import type { Clients } from "../../clients"
import { env } from "../../env"
import { makeRunStage, type QueueTable } from "../queue"
import { identifyVessel } from "./identify"
import { fetchVesselHistory } from "./history"
import { fetchVesselInspections } from "./inspections"
import { expandFleet } from "./fleet"
import { enrichCompanies, type EnrichResult } from "./enrich"
import { screenVesselSanctions, type VesselSanctionsResult } from "./sanctions"
import { screenOwnership } from "./ownership"
import { analyzeVesselAis } from "./ais"
import { assembleVesselEvidence } from "./evidence"
import { deterministicBrief, narrateVesselBrief } from "./synthesize"
import type { IdentifyResult, FleetResult } from "./types"

type Db = ReturnType<typeof createDb>

const TABLE: QueueTable = "screenings"
const EMPTY_FLEET: FleetResult = { companies: [], sisters: [], truncated: false, note: null }
const EMPTY_ENRICH: EnrichResult = { companies: [] }
const EMPTY_AIS: AisBehavior = emptyAisBehavior(false)
const UNAVAILABLE_SANCTIONS: VesselSanctionsResult = {
  status: "NO_MATCH", subjectHit: false, managementHit: false, subjectReviewMatch: false, subjectPoi: false,
  subjectSeverity: null, managementSeverity: null, parentSeverity: null,
  directSisterCount: 0, linkedSisterCount: 0,
  companyHits: [], sisterHits: [], parentHits: [], matches: [], unavailable: true,
}

function stored<T>(steps: Record<string, StageRecord>, name: string): T | undefined {
  return steps[name]?.output as T | undefined
}

export interface MonitorScreeningRow {
  id: string
  imo: string
  steps: Record<string, StageRecord>
  monitorId: string
  monitorRunId: string
}

interface MonitorConfig {
  checks: MonitorCheck[]
  notifyMode: MonitorNotifyMode
  createdBy: string
}

interface Baseline {
  id: string
  brief: VesselBrief | null
  steps: Record<string, StageRecord>
  watchSnapshot: WatchSnapshot | null
}

/** The monitor rule for a claimed run row (checks + owner). */
async function loadMonitor(db: Db, monitorId: string): Promise<MonitorConfig | null> {
  const rows = (await db.execute(sql`
    SELECT checks, notify_mode, created_by FROM monitors WHERE id = ${monitorId}
  `)) as any[]
  const m = rows[0]
  if (!m) return null
  return { checks: (m.checks ?? ["sanctions"]) as MonitorCheck[], notifyMode: m.notify_mode as MonitorNotifyMode, createdBy: m.created_by }
}

/** The most recent completed screening for this owner+vessel BEFORE this run —
 * both the seed for skipped stages and the snapshot we diff against. */
async function loadBaseline(db: Db, imo: string, createdBy: string, excludeId: string): Promise<Baseline | null> {
  const rows = (await db.execute(sql`
    SELECT id, brief, steps, watch_snapshot
    FROM screenings
    WHERE imo = ${imo} AND created_by = ${createdBy} AND status = 'completed' AND id <> ${excludeId}
    ORDER BY finished_at DESC NULLS LAST, updated_at DESC
    LIMIT 1
  `)) as any[]
  const b = rows[0]
  if (!b) return null
  return {
    id: b.id,
    brief: (b.brief ?? null) as VesselBrief | null,
    steps: (b.steps ?? {}) as Record<string, StageRecord>,
    watchSnapshot: (b.watch_snapshot ?? null) as WatchSnapshot | null,
  }
}

/**
 * Run one member of a monitor execution. Re-runs ONLY the stages the monitor's
 * checks require (seeding every other stage from the baseline so the pipeline
 * skips it), assembles the deterministic brief to build a change snapshot, diffs
 * it against the baseline over the selected facets, and only spends an LLM call
 * to write a fresh brief when something actually changed. A carried-forward
 * (unavailable) stage diffs to nothing, so an outage never false-fires a change.
 */
export async function runMonitorScreening(row: MonitorScreeningRow, c: Clients, log: Logger, db: Db): Promise<void> {
  const stageLog = (stage: string) => (log.child as any)({ screeningId: row.id, imo: row.imo, stage, monitorRunId: row.monitorRunId })
  const monitor = await loadMonitor(db, row.monitorId)
  if (!monitor) { stageLog("monitor").warn("monitor gone — skipping run member"); return }

  const baseline = await loadBaseline(db, row.imo, monitor.createdBy, row.id)
  const selectedStages = new Set(stagesForChecks(monitor.checks))

  // Seed skipped stages from the baseline (in-memory) so the shared stage runner
  // reuses their output; only the selected stages actually execute. With no
  // baseline this seeds nothing → a full first run that establishes the baseline.
  const steps: Record<string, StageRecord> = { ...row.steps }
  if (baseline) {
    for (const name of VESSEL_STAGE_NAMES) {
      if (name === "synthesize") continue
      if (!selectedStages.has(name) && baseline.steps[name]?.status === "done") steps[name] = baseline.steps[name]!
    }
  }

  const isDone = (name: string) => steps[name]?.status === "done"
  const total = VESSEL_STAGE_NAMES.length
  const doneCount = { value: 0 }
  const failedBestEffort: string[] = []
  const runStage = makeRunStage({ db, table: TABLE, rowId: row.id, stageLog, total, doneCount, failedBestEffort, isDone })

  // ---- gather (same stages as the screening pipeline; skips reuse the seed) ----
  const identifyOut = await runStage("identify", () => identifyVessel({ imo: row.imo }, c), true)
  const identity = identifyOut ?? stored<IdentifyResult>(steps, "identify")
  if (!identity) throw new Error("monitor run: identify output missing and no baseline to reuse")

  const historyOut = await runStage("history", () => fetchVesselHistory(row.imo, c), false)
  const history = historyOut ?? stored<VesselHistory>(steps, "history") ?? null

  const inspectionsOut = await runStage("inspections", () => fetchVesselInspections(row.imo, c), false)
  const inspections = inspectionsOut ?? stored<VesselInspections>(steps, "inspections") ?? null

  const caps = { maxSistersPerCompany: env.VESSEL_MAX_SISTERS_PER_COMPANY, maxSisterPages: env.VESSEL_MAX_SISTER_PAGES }
  const fleetOut = await runStage("fleet", () => expandFleet(row.imo, identity.companies, c, caps), false)
  const fleet = fleetOut ?? stored<FleetResult>(steps, "fleet") ?? EMPTY_FLEET

  const enrichOut = await runStage("enrich", () => enrichCompanies(identity.companies, c), false)
  const enrich = enrichOut ?? stored<EnrichResult>(steps, "enrich") ?? EMPTY_ENRICH

  const sancOut = await runStage("sanctions", () => screenVesselSanctions(identity.identity, identity.companies, fleet.sisters, c, enrich.companies), false)
  const sanctions = sancOut ?? stored<VesselSanctionsResult>(steps, "sanctions") ?? UNAVAILABLE_SANCTIONS

  const ownershipOut = await runStage("ownership", () => screenOwnership(identity.ownershipFlags, identity.identity, sanctions.matches, c, stageLog("ownership")), false)
  const ownership = ownershipOut ?? stored<InferredOwnership>(steps, "ownership") ?? null

  const aisOut = await runStage("ais", () => analyzeVesselAis(row.imo, c, { days: env.VESSEL_AIS_HISTORY_DAYS }), false)
  const ais = aisOut ?? stored<AisBehavior>(steps, "ais") ?? EMPTY_AIS

  // ---- deterministic assembly → snapshot → diff (no LLM yet) ----
  const { evidence, graph } = assembleVesselEvidence(
    identity.identity, identity.companies, fleet, sanctions, failedBestEffort, enrich.companies,
    history, inspections, ais, identity.geography ?? [], ownership?.flags ?? [],
  )
  const detBrief = deterministicBrief(row.imo, evidence, row.id, ownership)
  const nextSnap = buildWatchSnapshot(detBrief)
  const nextHash = hashSnapshot(nextSnap).overall

  const prevSnap = baseline ? (baseline.watchSnapshot ?? (baseline.brief ? buildWatchSnapshot(baseline.brief) : null)) : null
  const changes = prevSnap ? diffSnapshots(prevSnap, nextSnap, facetsForChecks(monitor.checks)) : []
  const changed = changes.length > 0
  // First run (no baseline snapshot) must produce a real brief; otherwise narrate
  // only when something changed. Unchanged runs carry the baseline brief forward.
  const mustNarrate = changed || !prevSnap

  if (mustNarrate) {
    const { brief, usage } = await narrateVesselBrief(row.imo, evidence, c, row.id, ownership)
    await db.execute(sql`
      UPDATE screenings
      SET status = 'completed',
          identity = ${JSON.stringify(brief.identity)}::jsonb,
          vessel_name = ${brief.identity.name},
          flag = ${brief.identity.flag},
          graph = ${JSON.stringify(graph)}::jsonb,
          brief = ${JSON.stringify(brief)}::jsonb,
          model_meta = ${JSON.stringify(usage)}::jsonb,
          watch_snapshot = ${JSON.stringify(nextSnap)}::jsonb,
          watch_hash = ${nextHash},
          finished_at = now(), updated_at = now()
      WHERE id = ${row.id}
    `)
  } else {
    // Unchanged: reuse the baseline's brief/graph (identical facts, real narrative)
    // and record the new snapshot. No LLM spend.
    await db.execute(sql`
      UPDATE screenings
      SET status = 'completed',
          identity = ${JSON.stringify(baseline!.brief?.identity ?? evidence.identity)}::jsonb,
          vessel_name = ${evidence.identity.name},
          flag = ${evidence.identity.flag},
          graph = COALESCE((SELECT graph FROM screenings WHERE id = ${baseline!.id}), graph),
          brief = ${JSON.stringify(baseline!.brief)}::jsonb,
          watch_snapshot = ${JSON.stringify(nextSnap)}::jsonb,
          watch_hash = ${nextHash},
          finished_at = now(), updated_at = now()
      WHERE id = ${row.id}
    `)
  }

  if (changed) {
    const escalation = changes.some((ch) => ch.escalation)
    await db.execute(sql`
      INSERT INTO monitor_changes (monitor_id, monitor_run_id, imo, vessel_name, screening_id, previous_screening_id, changes, escalation)
      VALUES (${row.monitorId}, ${row.monitorRunId}, ${row.imo}, ${evidence.identity.name}, ${row.id}, ${baseline?.id ?? null}, ${JSON.stringify(changes)}::jsonb, ${escalation})
    `)
    stageLog("changed").info({ changeCount: changes.length, escalation }, "monitor detected change")
  } else {
    stageLog("unchanged").info("monitor run: no watched change")
  }

  await finalizeRunIfComplete(db, row.monitorRunId, row.monitorId, log)
}

/** When every member of a monitor run has finished, close the run out and stamp
 * the monitor's last-run time. Count-based so it is safe to call per member. */
async function finalizeRunIfComplete(db: Db, monitorRunId: string, monitorId: string, log: Logger): Promise<void> {
  const rows = (await db.execute(sql`
    SELECT
      (SELECT screening_count FROM monitor_runs WHERE id = ${monitorRunId}) AS target,
      COUNT(*) FILTER (WHERE status IN ('completed','failed')) AS done,
      COUNT(*) FILTER (WHERE status = 'failed') AS failed
    FROM screenings WHERE monitor_run_id = ${monitorRunId}
  `)) as any[]
  const r = rows[0]
  if (!r) return
  const target = Number(r.target ?? 0)
  const done = Number(r.done ?? 0)
  const failed = Number(r.failed ?? 0)
  if (target === 0 || done < target) return

  const changedRows = (await db.execute(sql`SELECT COUNT(*) AS n FROM monitor_changes WHERE monitor_run_id = ${monitorRunId}`)) as any[]
  const changedCount = Number(changedRows[0]?.n ?? 0)
  const status = failed >= target ? "failed" : "completed"
  await db.execute(sql`
    UPDATE monitor_runs SET status = ${status}, changed_count = ${changedCount}, finished_at = now() WHERE id = ${monitorRunId}
  `)
  await db.execute(sql`UPDATE monitors SET last_run_at = now(), updated_at = now() WHERE id = ${monitorId}`)
  ;(log.child as any)({ monitorRunId, monitorId }).info({ target, changedCount, status }, "monitor run finalized")
}
