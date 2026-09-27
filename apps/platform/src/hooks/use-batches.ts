import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { batchSummarySchema, screeningSchema } from "@talasa/shared"
import type { BatchSummary, CreateBatchInput, Screening } from "@talasa/shared"
import { apiFetch } from "@/lib/api"

const KEY = ["batches"] as const
const SCREENINGS_KEY = ["screenings"] as const

const batchDetailSchema = batchSummarySchema.extend({ screenings: screeningSchema.array() })
export type BatchDetail = BatchSummary & { screenings: Screening[] }

/** A batch is still working while any member is queued or running. */
const inFlight = (b: BatchSummary): boolean => b.counts.queued + b.counts.running > 0

export function useBatches() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => batchSummarySchema.array().parse(await apiFetch<unknown>("/api/batches")),
    refetchInterval: (query) => ((query.state.data ?? []).some(inFlight) ? 2000 : false),
  })
}

export function useBatch(id: string) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: async () => batchDetailSchema.parse(await apiFetch<unknown>(`/api/batches/${id}`)),
    refetchInterval: (query) => (query.state.data && inFlight(query.state.data) ? 2000 : false),
  })
}

export function useCreateBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateBatchInput) =>
      apiFetch<{ id: string }>("/api/batches", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: SCREENINGS_KEY })
    },
  })
}

export function useDeleteBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/batches/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: SCREENINGS_KEY })
    },
  })
}

/** Archive a batch: hides it from the list and stops any monitor watching it. */
export function useArchiveBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/batches/${id}/archive`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: SCREENINGS_KEY })
      qc.invalidateQueries({ queryKey: ["monitors"] })
    },
  })
}
