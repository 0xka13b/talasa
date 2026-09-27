import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { monitorSummarySchema, monitorDetailSchema, monitorChangeSchema } from "@talasa/shared"
import type { CreateMonitorInput, UpdateMonitorInput, MonitorDetail } from "@talasa/shared"
import { apiFetch } from "@/lib/api"

const KEY = ["monitors"] as const
const CHANGES_KEY = ["monitor-changes"] as const
const SCREENINGS_KEY = ["screenings"] as const

/** A monitor detail is actively working while its most recent run is running. */
const detailInFlight = (d: MonitorDetail): boolean => d.runs[0]?.status === "running"

export function useMonitors() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => monitorSummarySchema.array().parse(await apiFetch<unknown>("/api/monitors")),
    // Light poll so freshly-detected changes + run status surface during a demo.
    refetchInterval: 5000,
  })
}

export function useMonitor(id: string) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: async () => monitorDetailSchema.parse(await apiFetch<unknown>(`/api/monitors/${id}`)),
    refetchInterval: (query) => (query.state.data && detailInFlight(query.state.data) ? 2500 : 8000),
  })
}

/** Cross-monitor change feed (for the sidebar badge + a changes view). */
export function useMonitorChanges(unacknowledgedOnly = false) {
  return useQuery({
    queryKey: [...CHANGES_KEY, { unacknowledgedOnly }],
    queryFn: async () =>
      monitorChangeSchema.array().parse(await apiFetch<unknown>(`/api/monitors/changes${unacknowledgedOnly ? "?unacked=1" : ""}`)),
    refetchInterval: 5000,
  })
}

/** Total unacknowledged changes across all monitors — the sidebar badge count. */
export function useUnacknowledgedCount(): number {
  const { data } = useMonitors()
  return (data ?? []).reduce((n, m) => n + m.unacknowledgedChanges, 0)
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: KEY })
  qc.invalidateQueries({ queryKey: CHANGES_KEY })
  qc.invalidateQueries({ queryKey: SCREENINGS_KEY })
}

export function useCreateMonitor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateMonitorInput) =>
      apiFetch<{ id: string }>("/api/monitors", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => invalidateAll(qc),
  })
}

export function useUpdateMonitor(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: UpdateMonitorInput) =>
      apiFetch<unknown>(`/api/monitors/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => {
      invalidateAll(qc)
      qc.invalidateQueries({ queryKey: [...KEY, id] })
    },
  })
}

export function useTriggerMonitor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/monitors/${id}/trigger`, { method: "POST" }),
    onSuccess: (_d, id) => {
      invalidateAll(qc)
      qc.invalidateQueries({ queryKey: [...KEY, id] })
    },
  })
}

export function useDeleteMonitor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/monitors/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateAll(qc),
  })
}

/** Archive a monitor: hides it from the list and stops all scheduled runs. */
export function useArchiveMonitor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/monitors/${id}/archive`, { method: "POST" }),
    onSuccess: () => invalidateAll(qc),
  })
}

export function useAcknowledgeChange() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (changeId: string) => apiFetch<void>(`/api/monitors/changes/${changeId}/ack`, { method: "POST" }),
    onSuccess: () => invalidateAll(qc),
  })
}

export function useAcknowledgeAll() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (monitorId: string) => apiFetch<{ acknowledged: number }>(`/api/monitors/${monitorId}/ack`, { method: "POST" }),
    onSuccess: (_d, monitorId) => {
      invalidateAll(qc)
      qc.invalidateQueries({ queryKey: [...KEY, monitorId] })
    },
  })
}
