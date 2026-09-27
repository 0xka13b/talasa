/**
 * Counterparty DD pipeline descriptor + orchestration.
 * The claim-loop / lease / per-stage persistence primitives live in queue.ts;
 * this file owns only the company-centric stage order + finalize.
 *
 * Stages: resolve → network → ownership → sanctions → synthesize.
 * `resolve` and `synthesize` are critical; the enrichment stages in between are
 * best-effort (a failure is remembered as a data gap, not a run failure).
 */
import { sql } from "drizzle-orm"
import { createDb } from "@talasa/db"
import { caseRef, STAGE_NAMES } from "@talasa/shared"
import type { StageRecord, StageName, CompanyOwnership } from "@talasa/shared"
import type { Logger } from "../log"
import type { Clients } from "../clients"
import { resolveEntity } from "./resolve"
import { mapCompanyNetwork, type NetworkResult } from "./network"
import { resolveOwnership } from "./ownership"
import { screenSanctions, type SanctionsResult } from "./sanctions"
import { synthesize } from "./synthesize"
import type { CaseInput } from "./types"
import { makeRunStage, runQueue, type Pipeline } from "./queue"

type Db = ReturnType<typeof createDb>

interface ProjectRow {
  id: string
  counterpartyName: string
  companyImo: string | null
  companyAddress: string | null
  role: string | null
  country: string | null
  createdAt: Date
  steps: Record<string, StageRecord>
}

const TABLE = "projects" as const
const EMPTY_SANCTIONS: SanctionsResult = { status: "NO_MATCH", matches: [], nodeCategories: {} }

function stored<T>(steps: Record<string, StageRecord>, name: StageName): T | undefined {
  return steps[name]?.output as T | undefined
}

function emptyNetwork(canonicalName: string, country: string | null, address: string | null): NetworkResult {
  return {
    companyProfile: { equasisId: null, name: canonicalName, address, country, fleetCount: 0 },
    fleet: [], linkedCompanies: [], owners: [], managers: [], detentions: [],
    affiliations: { nodes: [], edges: [] }, truncated: false,
  }
}

export async function runPipeline(project: ProjectRow, c: Clients, log: Logger, db: Db): Promise<void> {
  const ref = caseRef(project.counterpartyName, project.createdAt, project.id)
  const stageLog = (stage: string) => (log.child as any)({ caseRef: ref, stage })
  const isDone = (name: string) => project.steps[name as StageName]?.status === "done"

  const input: CaseInput = {
    queryName: project.counterpartyName,
    companyImo: project.companyImo,
    companyAddress: project.companyAddress,
    role: project.role,
    country: project.country ?? null,
  }

  const total = STAGE_NAMES.length
  const doneCount = { value: 0 }
  const failedBestEffort: string[] = []
  const runStage = makeRunStage({ db, table: TABLE, rowId: project.id, stageLog, total, doneCount, failedBestEffort, isDone })

  // Stage 1: resolve (critical) — fuzzy name / company IMO → canonical entity.
  const resolvedOut = await runStage("resolve", () => resolveEntity(input, c), true)
  const resolved = resolvedOut ?? stored<Awaited<ReturnType<typeof resolveEntity>>>(project.steps, "resolve")
  if (!resolved) throw new Error("resolve stage output missing on re-run")
  if (resolvedOut) {
    await db.execute(sql`UPDATE projects SET resolved = ${JSON.stringify(resolved)}::jsonb, updated_at = now() WHERE id = ${project.id}`)
  }

  // Stage 2: network (best-effort) — Equasis fleet + linked-company traversal.
  const networkOut = await runStage("network", () => mapCompanyNetwork(resolved, c), false)
  const network = networkOut ?? stored<NetworkResult>(project.steps, "network") ?? emptyNetwork(resolved.canonicalName, resolved.country, resolved.address ?? null)
  const subjectName = network.companyProfile.name || resolved.canonicalName

  // Stage 3: ownership (GLEIF corporate structure) — best-effort.
  const ownershipOut = await runStage("ownership", () => resolveOwnership(subjectName, c), false)
  const ownership = ownershipOut ?? stored<CompanyOwnership | null>(project.steps, "ownership") ?? null

  // Stage 4: sanctions (best-effort) — screens subject + linked + parents, plus a
  // capped set of vessel IMOs. The pool is the subject's fleet FIRST (so it's never
  // crowded out of the cap) then the affiliates' fleets (from the second-level
  // crawl), deduped — a shared vessel is never screened twice.
  const screenImos = [
    ...new Set([
      ...network.fleet.map((v) => v.imo),
      ...network.linkedCompanies.flatMap((lc) => lc.fleet.map((v) => v.imo)),
    ]),
  ]
  const sanctionsOut = await runStage("sanctions", () => screenSanctions({
    subjectName,
    equasisId: resolved.equasisCompanyId,
    country: resolved.country,
    linkedCompanies: network.linkedCompanies,
    ownership,
    fleetImos: screenImos,
  }, c), false)
  const sanctions = sanctionsOut ?? stored<SanctionsResult>(project.steps, "sanctions") ?? EMPTY_SANCTIONS

  // Stage 6: synthesize (critical) — evidence + graph + LLM narratives → brief.
  // On a re-claim where synthesize already ran but the worker died before the
  // finalize write below, runStage returns null (skip) — recover the stored
  // output so we still promote the brief and mark the row completed, rather than
  // leaving it stuck in 'running'.
  const synthResult = await runStage("synthesize", () => synthesize(input, resolved, network, ownership, sanctions, c, failedBestEffort, project.id), true)
  const synth = synthResult ?? stored<Awaited<ReturnType<typeof synthesize>>>(project.steps, "synthesize")
  if (!synth) return

  const { brief, usage } = synth
  brief.caseId = project.id
  await db.execute(sql`
    UPDATE projects
    SET status = 'completed', brief = ${JSON.stringify(brief)}::jsonb, model_meta = ${JSON.stringify(usage)}::jsonb,
        finished_at = now(), updated_at = now()
    WHERE id = ${project.id}
  `)
  stageLog("done").info("pipeline completed")
}

export const counterpartyPipeline: Pipeline = {
  table: TABLE,
  returningColumns: "id, counterparty_name, company_imo, company_address, role, country, created_at, steps",
  run: async (raw, c, log, db) => {
    const project: ProjectRow = {
      id: raw.id,
      counterpartyName: raw.counterparty_name,
      companyImo: raw.company_imo,
      companyAddress: raw.company_address,
      role: raw.role,
      country: raw.country,
      createdAt: new Date(raw.created_at),
      steps: (raw.steps ?? {}) as Record<string, StageRecord>,
    }
    log.info({ projectId: project.id, counterparty: project.counterpartyName }, "claimed project")
    await runPipeline(project, c, log, db)
  },
}

/** Back-compat wrapper — claims + runs one counterparty project. */
export async function claimAndRunOnce(c: Clients, log: Logger, db: Db): Promise<boolean> {
  return runQueue(counterpartyPipeline, c, log, db)
}
