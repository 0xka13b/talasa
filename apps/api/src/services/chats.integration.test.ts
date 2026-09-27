import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { db, user } from "@talasa/db"
import { createScreening, deleteScreening } from "./screenings"
import {
  createChat,
  deleteChat,
  ensureTitle,
  getChat,
  getMessages,
  listChatsForSubject,
  listChatsForUser,
  renameChat,
  saveMessages,
} from "./chats"

const USER_ID = "user_chat_test_1"
const OTHER_ID = "user_chat_test_2"
let screeningId: string

beforeAll(async () => {
  await db
    .insert(user)
    .values([
      { id: USER_ID, name: "Cap", email: "cap-chat@example.com", emailVerified: true },
      { id: OTHER_ID, name: "Mate", email: "mate-chat@example.com", emailVerified: true },
    ])
    .onConflictDoNothing()
  const s = await createScreening(USER_ID, { name: "Chat fixture", imo: "9304162" })
  screeningId = s.id
})

afterAll(async () => {
  await deleteScreening(USER_ID, screeningId)
})

describe("chats service", () => {
  it("creates a chat for an owned subject and scopes reads to the creator", async () => {
    const chat = await createChat(USER_ID, { subjectType: "screening", subjectId: screeningId })
    expect(chat.subjectType).toBe("screening")
    expect(chat.subjectId).toBe(screeningId)
    expect(chat.title).toBeNull()

    expect((await getChat(USER_ID, chat.id))?.id).toBe(chat.id)
    // Another user cannot read it.
    expect(await getChat(OTHER_ID, chat.id)).toBeNull()

    expect((await listChatsForUser(USER_ID)).some((c) => c.id === chat.id)).toBe(true)
    expect((await listChatsForSubject(USER_ID, "screening", screeningId)).some((c) => c.id === chat.id)).toBe(true)

    // One chat per subject: creating again reuses the same chat.
    const again = await createChat(USER_ID, { subjectType: "screening", subjectId: screeningId })
    expect(again.id).toBe(chat.id)

    await deleteChat(USER_ID, chat.id)
  })

  it("rejects creating a chat for a subject the user does not own", async () => {
    await expect(createChat(OTHER_ID, { subjectType: "screening", subjectId: screeningId })).rejects.toThrow()
  })

  it("round-trips messages ordered by seq and sets the title once", async () => {
    const chat = await createChat(USER_ID, { subjectType: "screening", subjectId: screeningId })

    // AI SDK message ids are non-UUID strings; the id column must accept them.
    await saveMessages(chat.id, [
      { id: "msg-user-abc123", role: "user", parts: [{ type: "text", text: "hello there" }] },
      { id: "msg-asst-def456", role: "assistant", parts: [{ type: "text", text: "hi" }] },
    ])

    const msgs = await getMessages(USER_ID, chat.id)
    expect(msgs?.map((m) => m.role)).toEqual(["user", "assistant"])

    await ensureTitle(chat.id, "hello there")
    expect((await getChat(USER_ID, chat.id))?.title).toBe("hello there")

    // ensureTitle is a no-op once a title exists.
    await ensureTitle(chat.id, "something else")
    expect((await getChat(USER_ID, chat.id))?.title).toBe("hello there")

    // rename works and is scoped.
    expect(await renameChat(OTHER_ID, chat.id, "nope")).toBe(false)
    expect(await renameChat(USER_ID, chat.id, "renamed")).toBe(true)
    expect((await getChat(USER_ID, chat.id))?.title).toBe("renamed")

    await deleteChat(USER_ID, chat.id)
    expect(await getChat(USER_ID, chat.id)).toBeNull()
  })

  // Regression: assistant replies used to arrive with an empty-string id ("").
  // Because messages.id is the primary key, two chats' assistant rows collided
  // on "" and the upsert clobbered a single global row — so a reloaded chat
  // showed only the user message. saveMessages must give each row a real id.
  it("persists a distinct assistant message per chat even when ids are blank", async () => {
    const a = await createChat(USER_ID, { subjectType: "screening", subjectId: screeningId })
    await saveMessages(a.id, [
      { id: "u-a", role: "user", parts: [{ type: "text", text: "chat A question" }] },
      { id: "", role: "assistant", parts: [{ type: "text", text: "chat A answer" }] },
    ])
    // Second chat reuses the same subject after A is deleted (one chat per subject).
    await deleteChat(USER_ID, a.id)
    const b = await createChat(USER_ID, { subjectType: "screening", subjectId: screeningId })
    await saveMessages(b.id, [
      { id: "u-b", role: "user", parts: [{ type: "text", text: "chat B question" }] },
      { id: "", role: "assistant", parts: [{ type: "text", text: "chat B answer" }] },
    ])

    const msgsB = await getMessages(USER_ID, b.id)
    expect(msgsB?.map((m) => m.role)).toEqual(["user", "assistant"])
    const asstB = msgsB?.find((m) => m.role === "assistant")
    expect(asstB?.id).not.toBe("")
    expect(asstB?.parts).toEqual([{ type: "text", text: "chat B answer" }])

    await deleteChat(USER_ID, b.id)
  })
})
