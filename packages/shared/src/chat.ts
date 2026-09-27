import { z } from "zod"

export const chatSubjectTypeSchema = z.enum(["screening", "project"])
export type ChatSubjectType = z.infer<typeof chatSubjectTypeSchema>

export const chatSchema = z.object({
  id: z.string().uuid(),
  subjectType: chatSubjectTypeSchema,
  subjectId: z.string().uuid(),
  title: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Chat = z.infer<typeof chatSchema>

// Messages are stored/returned as AI SDK UIMessages. `parts` is left opaque
// (the AI SDK owns its shape); we only constrain role + ordering fields.
export const chatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  parts: z.array(z.unknown()),
  createdAt: z.string(),
})
export type ChatMessage = z.infer<typeof chatMessageSchema>

export const createChatInput = z.object({
  subjectType: chatSubjectTypeSchema,
  subjectId: z.string().uuid(),
})
export type CreateChatInput = z.infer<typeof createChatInput>

export const renameChatInput = z.object({ title: z.string().min(1).max(200) })
export type RenameChatInput = z.infer<typeof renameChatInput>
