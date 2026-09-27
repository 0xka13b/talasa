import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { chatSchema } from "@talasa/shared"
import type { Chat, ChatSubjectType, CreateChatInput } from "@talasa/shared"
import { apiFetch } from "@/lib/api"

const KEY = ["chats"] as const

/** All of the user's chats, newest first — powers the nav list. */
export function useAllChats() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => chatSchema.array().parse(await apiFetch<unknown>("/api/chats")),
  })
}

/** Chats scoped to one subject — powers the panel's history dropdown. */
export function useSubjectChats(type: ChatSubjectType, id: string, enabled = true) {
  return useQuery({
    queryKey: [...KEY, type, id],
    enabled,
    queryFn: async () =>
      chatSchema
        .array()
        .parse(await apiFetch<unknown>(`/api/chats?subjectType=${type}&subjectId=${id}`)),
  })
}

export function useCreateChat() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateChatInput) =>
      apiFetch<Chat>("/api/chats", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useRenameChat() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      apiFetch<{ ok: true }>(`/api/chats/${id}`, { method: "PATCH", body: JSON.stringify({ title }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteChat() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/chats/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
