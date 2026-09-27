/**
 * Regenerates the seed snapshot from the CURRENT database.
 *
 * Captures a curated slice of example data: three finished vessel screenings
 * (by id), each renamed, with owner + set-membership stripped so the seed can
 * re-own them under the seeded admin account without dangling FKs. Linked
 * chats are intentionally NOT captured. Writes `seed/snapshot.json` (committed).
 *
 * Run:  pnpm --filter @talasa/db db:dump
 * Only needed when you want to refresh the committed snapshot.
 */
import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { inArray } from "drizzle-orm"
import { db } from "../client"
import { screenings } from "../schema"

// Screening id -> example display name. ONLY these screenings are captured.
const RENAME: Record<string, string> = {
  "e21e3dd4-e714-45d9-a2fe-fe58f7d0aa15": "Echo", // was "TOA PAYOH v2"
  "953204a7-ff39-43fc-ac46-d1cdff15b4e2": "Sierra", // was "Acme Tanker"
  "e01b4eb9-f84d-498f-95b0-26c88abda6da": "Tango", // was "PHAETHON"
}

const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, "..", "..", "seed", "snapshot.json")

async function main() {
  const ids = Object.keys(RENAME)
  const rows = await db.select().from(screenings).where(inArray(screenings.id, ids))
  if (rows.length !== ids.length) {
    const found = new Set(rows.map((r) => r.id))
    throw new Error(`snapshot: missing screening(s): ${ids.filter((id) => !found.has(id)).join(", ")}`)
  }

  // Rename, and strip owner + batch/monitor links: the seed re-owns each row
  // under the admin account, and we don't seed batches/monitors so those FKs must be
  // null. `createdBy` is dropped (undefined → omitted from JSON) and re-set at
  // seed time. Chats are excluded by construction (never queried).
  const screeningRows = rows.map((r) => ({
    ...r,
    name: RENAME[r.id],
    createdBy: undefined,
    batchId: null,
    monitorId: null,
    monitorRunId: null,
  }))

  const snapshot = { capturedAt: new Date().toISOString(), screenings: screeningRows }

  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + "\n")
  console.log(`snapshot written: ${screeningRows.length} screening(s) -> ${OUT}`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
