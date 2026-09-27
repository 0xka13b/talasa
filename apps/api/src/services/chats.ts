import { randomUUID } from "node:crypto"
import { and, asc, desc, eq } from "drizzle-orm"
import { chats, db, messages, projects, screenings } from "@talasa/db"

type SubjectType = "screening" | "project"

/** Assert the subject exists and belongs to the user; throws otherwise. */
async function assertSubject(userId: string, type: SubjectType, id: string) {
  const table = type === "screening" ? screenings : projects
  const [row] = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, id), eq(table.createdBy, userId)))
    .limit(1)
  if (!row) throw new Error("subject not found")
}

export async function createChat(userId: string, input: { subjectType: SubjectType; subjectId: string }) {
  await assertSubject(userId, input.subjectType, input.subjectId)
  // One chat per subject: reuse the existing chat if there is one, so a client
  // race can't spawn duplicates.
  const [existing] = await listChatsForSubject(userId, input.subjectType, input.subjectId)
  if (existing) return existing
  const [row] = await db
    .insert(chats)
    .values({ subjectType: input.subjectType, subjectId: input.subjectId, createdBy: userId })
    .returning()
  if (!row) throw new Error("Insert did not return a row")
  return row
}

export function listChatsForUser(userId: string) {
  return db.select().from(chats).where(eq(chats.createdBy, userId)).orderBy(desc(chats.updatedAt)).limit(50)
}

export function listChatsForSubject(userId: string, type: SubjectType, id: string) {
  return db
    .select()
    .from(chats)
    .where(and(eq(chats.createdBy, userId), eq(chats.subjectType, type), eq(chats.subjectId, id)))
    .orderBy(desc(chats.updatedAt))
}

export async function getChat(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(chats)
    .where(and(eq(chats.id, id), eq(chats.createdBy, userId)))
    .limit(1)
  return row ?? null
}

/** Messages for a chat, ordered by seq. Returns null if the chat isn't owned by the user. */
export async function getMessages(userId: string, chatId: string) {
  const chat = await getChat(userId, chatId)
  if (!chat) return null
  return db.select().from(messages).where(eq(messages.chatId, chatId)).orderBy(asc(messages.seq))
}

/** Upsert the messages produced by one stream turn (user + assistant). */
export async function saveMessages(chatId: string, rows: { id: string; role: "user" | "assistant"; parts: unknown }[]) {
  if (rows.length === 0) return
  for (const r of rows) {
    // Defence-in-depth: never persist an empty id. `messages.id` is the primary
    // key, so a blank id collides across chats and the upsert clobbers a single
    // global row (the bug that dropped assistant replies). Ids should already be
    // unique from the stream, but guard anyway.
    const id = r.id && r.id.length > 0 ? r.id : randomUUID()
    await db
      .insert(messages)
      .values({ id, chatId, role: r.role, parts: r.parts })
      .onConflictDoUpdate({ target: messages.id, set: { parts: r.parts, role: r.role } })
  }
  await db.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, chatId))
}

/** Set the chat title from the first user message, only if it has no title yet. */
export async function ensureTitle(chatId: string, firstUserText: string) {
  const [row] = await db.select({ title: chats.title }).from(chats).where(eq(chats.id, chatId)).limit(1)
  if (row && !row.title) {
    const title = firstUserText.trim().slice(0, 60) || "New chat"
    await db.update(chats).set({ title }).where(eq(chats.id, chatId))
  }
}

export async function renameChat(userId: string, id: string, title: string) {
  const [row] = await db
    .update(chats)
    .set({ title })
    .where(and(eq(chats.id, id), eq(chats.createdBy, userId)))
    .returning({ id: chats.id })
  return Boolean(row)
}

export async function deleteChat(userId: string, id: string) {
  const [row] = await db
    .delete(chats)
    .where(and(eq(chats.id, id), eq(chats.createdBy, userId)))
    .returning({ id: chats.id })
  return Boolean(row)
}
