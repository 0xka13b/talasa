/**
 * Integration tests for the company-centric pipeline orchestrator + claim loop.
 *
 * Requires a real Postgres connection (DATABASE_URL env var).
 * Clients are STUBBED so no external APIs are called.
 *
 * NOTE: this test shares the dev DATABASE_URL. It only INSERTs its own rows and
 * cleans them up in afterEach — never TRUNCATE / bulk-delete (that once wiped
 * real users/projects).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { createDb } from "@talasa/db"
import { sql } from "drizzle-orm"
import { briefSchema } from "@talasa/shared"
import type { Clients } from "../clients"
import { claimAndRunOnce } from "./run"

// ---------------------------------------------------------------------------
// DB wiring — use the same DATABASE_URL as the running app.
// ---------------------------------------------------------------------------

const db = createDb(process.env.DATABASE_URL!)

// ---------------------------------------------------------------------------
// Test user + project helpers
// ---------------------------------------------------------------------------

const TEST_USER_ID = "test-worker-user"

async function ensureTestUser() {
  await db.execute(sql`
    INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
    VALUES (
      ${TEST_USER_ID},
      'Test Worker',
      'test-worker@talasa.internal',
      true,
      now(),
      now()
    )
    ON CONFLICT (id) DO NOTHING
  `)
}

async function insertQueuedProject() {
  // RowList from postgres-js is array-like, not { rows: [] }
  const result = await db.execute(sql`
    INSERT INTO projects (
      name, counterparty_name, company_imo, role, country,
      status, created_by, created_at, updated_at
    )
    VALUES (
      'Test DD Case',
      'Acme Shipping Co',
      NULL,
      'charterer',
      'SG',
      'queued',
      ${TEST_USER_ID},
      now(),
      now()
    )
    RETURNING id
  `)
  return (result as any)[0].id as string
}

async function getProject(id: string) {
  const result = await db.execute(sql`SELECT * FROM projects WHERE id = ${id}`)
  return (result as any)[0] as {
    id: string
    status: string
    brief: unknown
    steps: unknown
    error: string | null
    started_at: string | null
    finished_at: string | null
    resolved: unknown
    model_meta: unknown
  }
}

// ---------------------------------------------------------------------------
// Stubbed clients — return canned data with no external I/O
// ---------------------------------------------------------------------------

function makeStubClients(): Clients {
  return {
    equasis: {
      // Resolve (name path).
      searchCompaniesByName: vi.fn().mockResolvedValue([{ id: "EQ1", name: "Acme Shipping Co", address: null }]),
      searchCompaniesById: vi.fn().mockResolvedValue([{ id: "EQ1", name: "Acme Shipping Co", address: null }]),
      // Network.
      getCompanyFleet: vi.fn().mockResolvedValue({
        companyImo: "EQ1",
        name: "Acme Shipping Co",
        vessels: [{ imo: "9000001", name: "MV Test Vessel", flag: "SG", type: "Bulk Carrier" }],
      }),
      getShipByImo: vi.fn().mockResolvedValue({
        particulars: { imo: "9000001", name: "MV Test Vessel", flag: "SG", shipType: "Bulk Carrier" },
        overview: {},
        geography: [],
        management: [
          { companyImo: "EQ1", role: "ISM Manager", name: "Acme Shipping Co", address: "1 Marina Blvd", dateOfEffect: null },
          { companyImo: "EQ2", role: "Registered Owner", name: "Beta Owner Ltd", address: null, dateOfEffect: null },
        ],
      }),
      getShipInspections: vi.fn().mockResolvedValue({ imo: "9000001", inspections: [] }),
    } as any,

    opensanctions: {
      screenCompany: vi.fn().mockResolvedValue({ label: "Acme Shipping Co", kind: "company", decision: "clear", matches: [] }),
      screenCounterparty: vi.fn().mockResolvedValue({ overall: "clear", results: [] }),
    } as any,

    gleif: {
      lookupCompany: vi.fn().mockResolvedValue(null),
    } as any,

    // Counterparty pipeline never touches AIS; null satisfies the Clients type.
    datalastic: null,

    // No geocoding in this test path; null disables place-labelling.
    geocoder: null,

    inference: {
      synthesizeBrief: vi.fn().mockResolvedValue({
        fields: {
          executiveSummary: "No issues identified.",
          affiliationsNarrative: "Affiliations appear benign.",
          ownershipNarrative: "Ownership could not be resolved via GLEIF.",
          sanctionsNarrative: "No sanctions found.",
          riskJustification: "Low risk.",
          recommendedActionRationale: "Approve.",
        },
        usage: {
          model: "claude-3-5-haiku-20241022",
          inputTokens: 500,
          outputTokens: 100,
          cachedTokens: 0,
        },
      }),
      choose: vi.fn().mockResolvedValue("Acme Shipping Co"),
    } as any,
  }
}

const nullLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child: () => nullLogger,
} as any

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("claimAndRunOnce — integration (real Postgres)", () => {
  let projectId: string

  beforeEach(async () => {
    // Ensure the FK-referenced test user exists, then insert a queued row.
    await ensureTestUser()
    projectId = await insertQueuedProject()
  })

  afterEach(async () => {
    // Clean up only the row we created (never a bulk wipe of the shared dev DB).
    await db.execute(sql`DELETE FROM projects WHERE id = ${projectId}`)
  })

  it("claims a queued project, runs all 5 stages, and sets status=completed with a valid brief", async () => {
    const clients = makeStubClients()
    const claimed = await claimAndRunOnce(clients, nullLogger, db)

    expect(claimed).toBe(true)

    const row = await getProject(projectId)

    // Status
    expect(row.status).toBe("completed")

    // Brief validates against briefSchema
    expect(row.brief).not.toBeNull()
    const parsedBrief = briefSchema.parse(row.brief)
    expect(parsedBrief).toBeTruthy()

    // caseId must be the project's stable UUID, not a generated timestamp
    expect(parsedBrief.caseId).toBe(projectId)

    // All 5 stages present and done
    const steps = row.steps as Record<string, { status: string }>
    expect(steps.resolve?.status).toBe("done")
    expect(steps.network?.status).toBe("done")
    expect(steps.ownership?.status).toBe("done")
    expect(steps.sanctions?.status).toBe("done")
    expect(steps.synthesize?.status).toBe("done")

    // finished_at set
    expect(row.finished_at).not.toBeNull()
  }, 30_000)

  it("returns false when no queued projects exist", async () => {
    // Remove the queued project first
    await db.execute(sql`UPDATE projects SET status = 'draft' WHERE id = ${projectId}`)

    const claimed = await claimAndRunOnce(makeStubClients(), nullLogger, db)
    expect(claimed).toBe(false)
  }, 10_000)

  it("re-claims a running project whose lease has expired", async () => {
    // Set the project to running with a very old started_at
    await db.execute(sql`
      UPDATE projects
      SET status = 'running',
          started_at = now() - interval '60 minutes',
          updated_at = now() - interval '60 minutes'
      WHERE id = ${projectId}
    `)

    const clients = makeStubClients()
    const claimed = await claimAndRunOnce(clients, nullLogger, db)

    expect(claimed).toBe(true)

    const row = await getProject(projectId)
    expect(row.status).toBe("completed")
  }, 30_000)

  it("sets status=failed and error when a critical stage (resolve) throws", async () => {
    const clients = makeStubClients()
    // Resolve is resilient to Equasis flakiness (the name search degrades to []),
    // so a critical failure comes from the OpenSanctions screen rejecting.
    ;(clients.opensanctions.screenCompany as any).mockRejectedValue(new Error("OpenSanctions unavailable"))

    const claimed = await claimAndRunOnce(clients, nullLogger, db)

    expect(claimed).toBe(true)

    const row = await getProject(projectId)
    expect(row.status).toBe("failed")
    expect(row.error).toContain("OpenSanctions unavailable")
  }, 30_000)

  it("survives Equasis name-search failure by degrading resolve (no hard fail)", async () => {
    const clients = makeStubClients()
    // Equasis flaky/throttled: the name search rejects. Resolve must NOT fail the
    // run — it degrades (empty fleet) and the pipeline still completes.
    ;(clients.equasis.searchCompaniesByName as any).mockRejectedValue(new Error("Equasis 429"))

    const claimed = await claimAndRunOnce(clients, nullLogger, db)
    expect(claimed).toBe(true)

    const row = await getProject(projectId)
    expect(row.status).toBe("completed")
  }, 30_000)

  it("completes even when a best-effort stage (sanctions) fails", async () => {
    const clients = makeStubClients()
    // Make sanctions fail consistently
    ;(clients.opensanctions.screenCounterparty as any).mockRejectedValue(
      new Error("OpenSanctions timeout"),
    )

    const claimed = await claimAndRunOnce(clients, nullLogger, db)

    expect(claimed).toBe(true)

    const row = await getProject(projectId)
    // Should still complete (sanctions is best-effort)
    expect(row.status).toBe("completed")

    const steps = row.steps as Record<string, { status: string }>
    expect(steps.sanctions?.status).toBe("failed")
    expect(steps.synthesize?.status).toBe("done")

    // Gaps should include "sanctions"
    const brief = briefSchema.parse(row.brief)
    expect(brief.dataCompleteness.gaps).toContain("sanctions")
  }, 30_000)

  it("skips a stage already marked done on re-run (idempotency)", async () => {
    // Seed a queued project whose `resolve` stage is already `done` and whose
    // resolved entity is persisted in steps.resolve.output. The orchestrator
    // must SKIP resolve and reuse the stored output, while still completing.
    const resolvedEntity = {
      canonicalName: "Acme Shipping Co",
      aliases: [],
      country: "SG",
      address: null,
      equasisCompanyId: "EQ1",
      fleetImos: ["9000001"],
      sanctionsEntityId: null,
      confidence: 0.85,
    }
    const doneResolveStep = {
      resolve: {
        status: "done",
        attempts: 1,
        startedAt: "2026-01-01T00:00:00.000Z",
        finishedAt: "2026-01-01T00:00:01.000Z",
        durationMs: 1000,
        error: null,
        output: resolvedEntity,
      },
    }

    await db.execute(sql`
      UPDATE projects
      SET steps    = ${JSON.stringify(doneResolveStep)}::jsonb,
          resolved = ${JSON.stringify(resolvedEntity)}::jsonb
      WHERE id = ${projectId}
    `)

    const clients = makeStubClients()
    const claimed = await claimAndRunOnce(clients, nullLogger, db)

    expect(claimed).toBe(true)

    // If resolve is correctly SKIPPED, its (name-path) resolver deps are never
    // touched — only the network stage runs, enumerating from the stored id.
    expect(clients.equasis.searchCompaniesByName).not.toHaveBeenCalled()
    expect(clients.opensanctions.screenCompany).not.toHaveBeenCalled()
    expect(clients.equasis.getCompanyFleet).toHaveBeenCalledWith("EQ1")

    const row = await getProject(projectId)
    expect(row.status).toBe("completed")

    const steps = row.steps as Record<string, { status: string; attempts: number }>
    // resolve retains its pre-seeded record (untouched), still done
    expect(steps.resolve?.status).toBe("done")
    expect(steps.resolve?.attempts).toBe(1)
    // remaining stages ran and completed
    expect(steps.network?.status).toBe("done")
    expect(steps.synthesize?.status).toBe("done")
  }, 30_000)

  it("recovers a crash between synthesize-done and the finalize write", async () => {
    // Run once to completion so steps.synthesize.output holds {brief, usage}.
    await claimAndRunOnce(makeStubClients(), nullLogger, db)
    // Simulate a worker that died AFTER persisting synthesize=done but BEFORE the
    // finalize UPDATE: reset the row to a lease-expired 'running' with no brief.
    await db.execute(sql`
      UPDATE projects
      SET status = 'running', brief = NULL, finished_at = NULL,
          started_at = now() - interval '1 hour', updated_at = now() - interval '1 hour'
      WHERE id = ${projectId}
    `)

    // Re-claim: every stage (incl. synthesize) is already done, so the orchestrator
    // must recover the stored synthesize output and still finalize — not hang in 'running'.
    const claimed = await claimAndRunOnce(makeStubClients(), nullLogger, db)
    expect(claimed).toBe(true)

    const row = await getProject(projectId)
    expect(row.status).toBe("completed")
    expect(row.brief).not.toBeNull()
    expect(briefSchema.parse(row.brief).caseId).toBe(projectId)
  }, 30_000)
})
