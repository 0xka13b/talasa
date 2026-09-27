import { describe, expect, it } from "vitest"
import { chatSchema, createChatInput, renameChatInput } from "./chat.js"

describe("chat schemas", () => {
  it("parses a chat", () => {
    const now = new Date().toISOString()
    const parsed = chatSchema.parse({
      id: "11111111-1111-1111-1111-111111111111",
      subjectType: "screening",
      subjectId: "22222222-2222-2222-2222-222222222222",
      title: "Hello",
      createdAt: now,
      updatedAt: now,
    })
    expect(parsed.subjectType).toBe("screening")
  })

  it("allows a null title", () => {
    const now = new Date().toISOString()
    const parsed = chatSchema.parse({
      id: "11111111-1111-1111-1111-111111111111",
      subjectType: "project",
      subjectId: "22222222-2222-2222-2222-222222222222",
      title: null,
      createdAt: now,
      updatedAt: now,
    })
    expect(parsed.title).toBeNull()
  })

  it("rejects a bad subject type", () => {
    expect(() => createChatInput.parse({ subjectType: "nope", subjectId: "22222222-2222-2222-2222-222222222222" })).toThrow()
  })

  it("requires a non-empty title on rename", () => {
    expect(() => renameChatInput.parse({ title: "" })).toThrow()
  })
})
