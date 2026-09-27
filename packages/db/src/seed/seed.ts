/**
 * Seeds a local database with one admin account that owns the three curated
 * example screenings (`seed/snapshot.json`), so a fresh install lands in a
 * populated dashboard.
 *
 *   email:    admin@talasa.sh
 *   password: qwerty12345
 *
 * Idempotent: re-running replaces the admin account (cascade clears its data)
 * and re-inserts the same rows. LOCAL DEV DATA — the password is public.
 *
 * Prereq: DB up + migrated. Run:  pnpm --filter @talasa/db db:seed
 */
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { hashPassword } from "better-auth/crypto"
import { eq } from "drizzle-orm"
import { db } from "../client"
import { account, screenings, user } from "../schema"

const ADMIN = {
  id: "admin-user",
  name: "Admin",
  email: "admin@talasa.sh",
  password: "qwerty12345",
} as const

const here = dirname(fileURLToPath(import.meta.url))
const SNAPSHOT = join(here, "..", "..", "seed", "snapshot.json")

interface Snapshot {
  capturedAt?: string
  screenings: Record<string, unknown>[]
}

// JSON stores timestamps as ISO strings; Drizzle `timestamp` columns want Dates.
const SCREENING_DATE_FIELDS = ["startedAt", "finishedAt", "createdAt", "updatedAt"] as const
function reviveDates(row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row }
  for (const f of SCREENING_DATE_FIELDS) {
    if (typeof out[f] === "string") out[f] = new Date(out[f] as string)
  }
  return out
}

async function main() {
  const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as Snapshot
  const screeningRows = snapshot.screenings.map((t) => ({
    ...reviveDates(t),
    createdBy: ADMIN.id,
    batchId: null,
    monitorId: null,
    monitorRunId: null,
  }))

  // Hash outside the transaction (async scrypt).
  const now = new Date()
  const passwordHash = await hashPassword(ADMIN.password)

  await db.transaction(async (tx) => {
    // Replace the admin account; its screenings go with it via ON DELETE CASCADE.
    await tx.delete(user).where(eq(user.email, ADMIN.email))
    await tx.insert(user).values({
      id: ADMIN.id,
      name: ADMIN.name,
      email: ADMIN.email,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    })
    await tx.insert(account).values({
      id: "admin-account",
      accountId: ADMIN.id,
      providerId: "credential",
      userId: ADMIN.id,
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    })
    if (screeningRows.length) await tx.insert(screenings).values(screeningRows as never)
  })

  console.log(`\nseeded ${ADMIN.email} (password: ${ADMIN.password}) × ${screeningRows.length} screening(s)\n`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
