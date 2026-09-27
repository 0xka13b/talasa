import { z } from "zod"

export const PROJECT_STATUSES = ["draft", "queued", "running", "completed", "failed"] as const
export const projectStatusSchema = z.enum(PROJECT_STATUSES)
export type ProjectStatus = z.infer<typeof projectStatusSchema>

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "Draft",
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
}

export const stageRecordSchema = z.object({
  status: z.enum(["pending", "running", "done", "failed"]),
  attempts: z.number(),
  startedAt: z.string().nullish(),
  finishedAt: z.string().nullish(),
  durationMs: z.number().nullish(),
  error: z.string().nullable().optional(),
  output: z.unknown().optional(),
}).passthrough()
export type StageRecordView = z.infer<typeof stageRecordSchema>

export const progressSchema = z.object({ done: z.number(), total: z.number() })

/** Counterparty's role in the intended deal. `unknown` when the broker can't say. */
export const PROJECT_ROLES = ["charterer", "owner", "operator", "broker", "unknown"] as const
export type ProjectRole = (typeof PROJECT_ROLES)[number]

/**
 * One Equasis company-search hit — the shape returned by
 * `GET /api/equasis/company?name=`. The intake form searches Equasis, the broker
 * picks one of these, and its `id` (Equasis company number) + `name` (canonical
 * legal name) + `address` become the screening's anchor.
 */
export const companySearchResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().nullable(),
})
export type CompanySearchResult = z.infer<typeof companySearchResultSchema>

export const createProjectSchema = z.object({
  counterpartyName: z.string().min(1).max(200),
  name: z.string().max(200).nullish(),
  /** Equasis company number of the picked company — resolves it directly (exact,
   * no fuzzy matching) and enumerates its fleet. Absent when the broker screened
   * a typed name with no Equasis match. */
  companyImo: z.string().max(20).nullish(),
  /** Registered address of the picked Equasis company, carried from the search
   * result so screening is anchored to the exact entity (name + number + address). */
  companyAddress: z.string().max(300).nullish(),
  role: z.string().max(50).nullish(),
  notes: z.string().max(5000).nullish(),
  // Retained for back-compat with older clients; the current company-centric
  // intake form no longer surfaces these.
  vesselName: z.string().max(200).nullish(),
  vesselMmsi: z.string().max(20).nullish(),
})
export type CreateProjectInput = z.infer<typeof createProjectSchema>

export const updateProjectSchema = createProjectSchema.partial()
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  vesselName: z.string().nullable(),
  vesselImo: z.string().nullable(),
  vesselMmsi: z.string().nullable(),
  companyImo: z.string().nullable(),
  companyAddress: z.string().nullable(),
  counterpartyName: z.string(),
  country: z.string().nullable(),
  role: z.string().nullable(),
  newsWindowDays: z.number().nullable(),
  notes: z.string().nullable(),
  status: projectStatusSchema,
  brief: z.unknown().nullable(),
  resolved: z.unknown().nullable(),
  steps: z.record(z.string(), stageRecordSchema).nullable().default({}),
  progress: progressSchema.nullable(),
  modelMeta: z.unknown().nullable(),
  error: z.string().nullable(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Project = z.infer<typeof projectSchema>
