import { randomUUID } from "node:crypto"
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai"
import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { createChatInput, renameChatInput } from "@talasa/shared"
import type { AuthUser } from "../auth/middleware"
import { requireAuth } from "../auth/middleware"
import { buildSystemPrompt, loadSubject } from "../services/chat-context"
import { buildTools } from "../services/chat-tools"
import * as svc from "../services/chats"
import { chatModel } from "../services/inference-provider"

export const chatsRouter = new Hono<{ Variables: { user: AuthUser } }>()

chatsRouter.use("*", requireAuth)

chatsRouter.post("/", zValidator("json", createChatInput), async (c) => {
  try {
    const chat = await svc.createChat(c.get("user").id, c.req.valid("json"))
    return c.json(chat, 201)
  } catch {
    return c.json({ error: "Subject not found" }, 404)
  }
})

chatsRouter.get("/", async (c) => {
  const userId = c.get("user").id
  const type = c.req.query("subjectType")
  const id = c.req.query("subjectId")
  if ((type === "screening" || type === "project") && id) {
    return c.json(await svc.listChatsForSubject(userId, type, id))
  }
  return c.json(await svc.listChatsForUser(userId))
})

chatsRouter.get("/:id", async (c) => {
  const userId = c.get("user").id
  const chat = await svc.getChat(userId, c.req.param("id"))
  if (!chat) return c.json({ error: "Not found" }, 404)
  const messages = await svc.getMessages(userId, chat.id)
  return c.json({ chat, messages: messages ?? [] })
})

chatsRouter.patch("/:id", zValidator("json", renameChatInput), async (c) => {
  const ok = await svc.renameChat(c.get("user").id, c.req.param("id"), c.req.valid("json").title)
  return ok ? c.json({ ok: true }) : c.json({ error: "Not found" }, 404)
})

chatsRouter.delete("/:id", async (c) => {
  const ok = await svc.deleteChat(c.get("user").id, c.req.param("id"))
  return ok ? c.body(null, 204) : c.json({ error: "Not found" }, 404)
})

chatsRouter.post("/:id/stream", async (c) => {
  const userId = c.get("user").id
  const chat = await svc.getChat(userId, c.req.param("id"))
  if (!chat) return c.json({ error: "Not found" }, 404)

  const subject = await loadSubject(userId, chat.subjectType, chat.subjectId)
  if (!subject) return c.json({ error: "Subject not found" }, 404)

  const { messages } = (await c.req.json()) as { messages: UIMessage[] }

  const result = streamText({
    model: chatModel(),
    system: buildSystemPrompt(subject),
    messages: convertToModelMessages(messages),
    tools: buildTools(subject),
    stopWhen: stepCountIs(8),
  })

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    // CRITICAL: without this the streamed assistant message defaults to an empty
    // id (""). Since messages.id is the primary key, every assistant turn would
    // then collide on "" and the upsert would overwrite one global row instead of
    // inserting per chat — so assistant replies vanished on reload. Give each a
    // real unique id.
    generateMessageId: () => randomUUID(),
    // Surface stream/tool/model errors instead of silently masking them (and
    // losing the turn). The returned string is what the user sees in place of the
    // failed assistant content.
    onError: (error) => {
      console.error("[chat stream] error", error)
      return "The agent hit an error while responding. Please try again."
    },
    // Stamp the assistant message with a send time for the UI timestamp.
    messageMetadata: ({ part }) => (part.type === "start" ? { createdAt: new Date().toISOString() } : undefined),
    onFinish: async ({ messages: finalMessages }) => {
      await svc.saveMessages(
        chat.id,
        finalMessages.map((m) => ({ id: m.id, role: m.role as "user" | "assistant", parts: m.parts })),
      )
      const firstUser = finalMessages.find((m) => m.role === "user")
      const text = firstUser?.parts
        ?.map((p) => (p.type === "text" ? p.text : ""))
        .join(" ")
        .trim()
      if (text) await svc.ensureTitle(chat.id, text)
    },
  })
})
