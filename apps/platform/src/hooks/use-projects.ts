import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { projectSchema } from "@talasa/shared"
import type { CreateProjectInput, Project, UpdateProjectInput } from "@talasa/shared"
import { apiFetch } from "@/lib/api"

const KEY = ["projects"] as const
const IN_FLIGHT: Project["status"][] = ["queued", "running"]

/** Most-recent-first slice of projects, for the sidebar's nested list. */
export function recentProjects(projects: Project[], limit = 5): Project[] {
  return [...projects].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit)
}

export function useProjects() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => projectSchema.array().parse(await apiFetch<unknown>("/api/projects")),
    refetchInterval: (query) =>
      (query.state.data ?? []).some((p) => IN_FLIGHT.includes(p.status)) ? 1500 : false,
  })
}

export function useProject(id: string) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: async () => projectSchema.parse(await apiFetch<unknown>(`/api/projects/${id}`)),
    refetchInterval: (query) => (query.state.data && IN_FLIGHT.includes(query.state.data.status) ? 1500 : false),
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateProjectInput) =>
      apiFetch<Project>("/api/projects", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: (project) => {
      // Show the new project in the sidebar immediately, then reconcile with the
      // server. Guard against a double-insert if a refetch has already landed it.
      qc.setQueryData<Project[]>(KEY, (prev) =>
        prev?.some((p) => p.id === project.id) ? prev : [project, ...(prev ?? [])]
      )
      qc.invalidateQueries({ queryKey: KEY })
    },
  })
}

export function useUpdateProject(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateProjectInput) =>
      apiFetch<Project>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useRunProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<Project>(`/api/projects/${id}/run`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
