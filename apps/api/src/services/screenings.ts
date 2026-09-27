import { and, desc, eq } from "drizzle-orm"
import type { CreateScreeningInput, GraphBoard } from "@talasa/shared"
import { db, screenings } from "@talasa/db"

export function listScreenings(userId: string) {
  // Archived screenings are retained but excluded from the active list.
  return db
    .select()
    .from(screenings)
    .where(and(eq(screenings.createdBy, userId), eq(screenings.archived, false)))
    .orderBy(desc(screenings.createdAt))
}

export async function getScreening(userId: string, id: string) {
  const [row] = await db.select().from(screenings).where(and(eq(screenings.id, id), eq(screenings.createdBy, userId)))
  return row ?? null
}

export async function createScreening(userId: string, input: CreateScreeningInput) {
  // `name` is optional. When blank, store an IMO placeholder that the identify
  // pipeline stage later backfills with the resolved vessel name (see runVesselPipeline).
  const name = input.name?.trim() || `IMO ${input.imo}`
  const [row] = await db.insert(screenings).values({ name, imo: input.imo, createdBy: userId }).returning()
  if (!row) throw new Error("Insert did not return a row")
  return row
}

export async function runScreening(userId: string, id: string) {
  const [row] = await db
    .update(screenings)
    .set({ status: "queued", error: null, brief: null, identity: null, graph: null, steps: {}, progress: null, modelMeta: null, startedAt: null, finishedAt: null, updatedAt: new Date() })
    .where(and(eq(screenings.id, id), eq(screenings.createdBy, userId)))
    .returning()
  return row ?? null
}

/** Persist the user's relationship-graph board overlay (positions + annotations). */
export async function saveGraphBoard(userId: string, id: string, board: GraphBoard) {
  const [row] = await db
    .update(screenings)
    .set({ graphBoard: board, updatedAt: new Date() })
    .where(and(eq(screenings.id, id), eq(screenings.createdBy, userId)))
    .returning()
  return row ?? null
}

/** Soft-archive a screening: hidden from the active list, kept in the DB. */
export async function archiveScreening(userId: string, id: string) {
  const [row] = await db
    .update(screenings)
    .set({ archived: true, updatedAt: new Date() })
    .where(and(eq(screenings.id, id), eq(screenings.createdBy, userId)))
    .returning()
  return row ?? null
}

export async function deleteScreening(userId: string, id: string) {
  const [row] = await db.delete(screenings).where(and(eq(screenings.id, id), eq(screenings.createdBy, userId))).returning({ id: screenings.id })
  return Boolean(row)
}
