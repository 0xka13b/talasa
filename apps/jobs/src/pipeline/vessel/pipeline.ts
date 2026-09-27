import { sql } from "drizzle-orm"
import { createDb } from "@talasa/db"
import { VESSEL_STAGE_NAMES, emptyAisBehavior } from "@talasa/shared"
import type { AisBehavior, InferredOwnership, StageRecord, VesselHistory, VesselInspections } from "@talasa/shared"
import type { Logger } from "../../log"
import type { Clients } from "../../clients"
import { makeRunStage, runQueue, type Pipeline } from "../queue"
import { env } from "../../env"
import { identifyVessel } from "./identify"
import { fetchVesselHistory } from "./history"
import { fetchVesselInspections } from "./inspections"
import { expandFleet } from "./fleet"
import { enrichCompanies, type EnrichResult } from "./enrich"
import { screenVesselSanctions, type VesselSanctionsResult } from "./sanctions"
import { screenOwnership } from "./ownership"
import { analyzeVesselAis } from "./ais"
import { synthesizeVessel } from "./synthesize"
import { runMonitorScreening } from "./monitor-run"
import type { IdentifyResult, FleetResult } from "./types"

type Db = ReturnType<typeof createDb>

export interface ScreeningRow {
  id: string
  imo: string
  steps: Record<string, StageRecord>
}

const TABLE = "screenings" as const
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

export async function runVesselPipeline(screening: ScreeningRow, c: Clients, log: Logger, db: Db): Promise<void> {
  const stageLog = (stage: string) => (log.child as any)({ screeningId: screening.id, imo: screening.imo, stage })
  const isDone = (name: string) => screening.steps[name]?.status === "done"
  const total = VESSEL_STAGE_NAMES.length
  const doneCount = { value: 0 }
  const failedBestEffort: string[] = []
  const runStage = makeRunStage({ db, table: TABLE, rowId: screening.id, stageLog, total, doneCount, failedBestEffort, isDone })

  // Stage 1: identify (critical)
  const identifyOut = await runStage("identify", () => identifyVessel({ imo: screening.imo }, c), true)
  const identity0 = identifyOut ?? stored<IdentifyResult>(screening.steps, "identify")
  if (!identity0) throw new Error("identify stage output missing on re-run")
  if (identifyOut) {
    // Backfill the screening label with the resolved vessel name only when the
    // user left it blank at intake (stored as the "IMO <imo>" placeholder).
    const blankPlaceholder = `IMO ${screening.imo}`
    await db.execute(sql`
      UPDATE screenings
      SET identity = ${JSON.stringify(identity0.identity)}::jsonb,
          vessel_name = ${identity0.identity.name},
          flag = ${identity0.identity.flag},
          name = CASE WHEN name = ${blankPlaceholder} THEN COALESCE(${identity0.identity.name}, name) ELSE name END,
          updated_at = now()
      WHERE id = ${screening.id}
    `)
  }

  // Stage 2: history (best-effort) — subject vessel's flag / name / owner changes over time
  const historyOut = await runStage("history", () => fetchVesselHistory(screening.imo, c), false)
  const history0 = historyOut ?? stored<VesselHistory>(screening.steps, "history") ?? null

  // Stage 3: inspections (best-effort) — subject vessel's full PSC inspection history
  const inspectionsOut = await runStage("inspections", () => fetchVesselInspections(screening.imo, c), false)
  const inspections0 = inspectionsOut ?? stored<VesselInspections>(screening.steps, "inspections") ?? null

  // Stage 4: fleet (best-effort)
  const caps = { maxSistersPerCompany: env.VESSEL_MAX_SISTERS_PER_COMPANY, maxSisterPages: env.VESSEL_MAX_SISTER_PAGES }
  const fleetOut = await runStage("fleet", () => expandFleet(screening.imo, identity0.companies, c, caps), false)
  const fleet0 = fleetOut ?? stored<FleetResult>(screening.steps, "fleet") ?? EMPTY_FLEET

  // Stage 5: enrich (best-effort) — GLEIF company legal info + parents
  const enrichOut = await runStage("enrich", () => enrichCompanies(identity0.companies, c), false)
  const enrich0 = enrichOut ?? stored<EnrichResult>(screening.steps, "enrich") ?? EMPTY_ENRICH

  // Stage 6: sanctions (best-effort)
  const sancOut = await runStage("sanctions", () => screenVesselSanctions(identity0.identity, identity0.companies, fleet0.sisters, c, enrich0.companies), false)
  const sanctions0 = sancOut ?? stored<VesselSanctionsResult>(screening.steps, "sanctions") ?? UNAVAILABLE_SANCTIONS

  // Stage 7: ownership (best-effort, OPTIONAL) — only does work when registry
  // ownership came back undisclosed/unknown; infers a candidate network from the
  // sanctions-list narrative. Never overrides the registry `companies` data.
  const ownershipOut = await runStage("ownership", () => screenOwnership(identity0.ownershipFlags, identity0.identity, sanctions0.matches, c, stageLog("ownership")), false)
  const ownership0 = ownershipOut ?? stored<InferredOwnership>(screening.steps, "ownership") ?? null

  // Stage 8: ais (best-effort) — Datalastic track → deterministic behaviour detectors
  const aisOut = await runStage("ais", () => analyzeVesselAis(screening.imo, c, { days: env.VESSEL_AIS_HISTORY_DAYS }), false)
  const ais0 = aisOut ?? stored<AisBehavior>(screening.steps, "ais") ?? EMPTY_AIS

  // Stage 9: synthesize (critical)
  const synthOut = await runStage("synthesize", () => synthesizeVessel(screening.imo, identity0.identity, identity0.companies, fleet0, sanctions0, c, failedBestEffort, screening.id, enrich0.companies, history0, inspections0, ais0, identity0.geography ?? [], ownership0), true)
  if (!synthOut) return

  const { brief, graph, usage } = synthOut
  await db.execute(sql`
    UPDATE screenings
    SET status = 'completed',
        identity = ${JSON.stringify(brief.identity)}::jsonb,
        graph = ${JSON.stringify(graph)}::jsonb,
        brief = ${JSON.stringify(brief)}::jsonb,
        model_meta = ${JSON.stringify(usage)}::jsonb,
        finished_at = now(), updated_at = now()
    WHERE id = ${screening.id}
  `)
  stageLog("done").info("vessel screening completed")
}

export const vesselPipeline: Pipeline = {
  table: TABLE,
  returningColumns: "id, imo, steps, monitor_id, monitor_run_id",
  run: async (raw, c, log, db) => {
    // A row tagged with a monitor run is a recurring re-screen: run only the
    // monitor's selected checks and diff, rather than the full pipeline.
    if (raw.monitor_run_id) {
      log.info({ screeningId: raw.id, imo: raw.imo, monitorRunId: raw.monitor_run_id }, "claimed monitor run")
      await runMonitorScreening(
        { id: raw.id, imo: raw.imo, steps: (raw.steps ?? {}) as Record<string, StageRecord>, monitorId: raw.monitor_id, monitorRunId: raw.monitor_run_id },
        c, log, db,
      )
      return
    }
    const screening: ScreeningRow = { id: raw.id, imo: raw.imo, steps: (raw.steps ?? {}) as Record<string, StageRecord> }
    log.info({ screeningId: screening.id, imo: screening.imo }, "claimed screening")
    await runVesselPipeline(screening, c, log, db)
  },
}

/** Convenience for parity with claimAndRunOnce. */
export async function claimAndRunVessel(c: Clients, log: Logger, db: Db): Promise<boolean> {
  return runQueue(vesselPipeline, c, log, db)
}
