import { z } from "zod"
import { VESSEL_STAGE_NAMES, type VesselStageName } from "./vessel.js"
import { WATCH_FACETS, watchChangeSchema, type WatchFacet } from "./watch-snapshot.js"

/**
 * Recurring vessel monitoring: a saved rule that re-screens a vessel (or a batch
 * of vessels) on a schedule, re-running ONLY the checks the user selected, then
 * diffs the result against the previous run to surface — and optionally notify on
 * — what changed. See {@link ./watch-snapshot.ts} for the change-detection core.
 */

// ---- cadence ---------------------------------------------------------------
export const MONITOR_CADENCES = ["daily", "weekly", "biweekly", "monthly"] as const
export type MonitorCadence = (typeof MONITOR_CADENCES)[number]
export const monitorCadenceSchema = z.enum(MONITOR_CADENCES)

/** Days between runs for each cadence — used to compute the next run time. */
export const CADENCE_DAYS: Record<MonitorCadence, number> = { daily: 1, weekly: 7, biweekly: 14, monthly: 30 }

// ---- checks (what to re-run + compare) -------------------------------------
export const MONITOR_CHECKS = ["sanctions", "ownership", "ais", "inspections", "fleet", "flag"] as const
export type MonitorCheck = (typeof MONITOR_CHECKS)[number]
export const monitorCheckSchema = z.enum(MONITOR_CHECKS)

/** Human labels for the check picker. */
export const CHECK_LABELS: Record<MonitorCheck, string> = {
  sanctions: "Sanctions",
  ownership: "Ownership",
  ais: "AIS behaviour",
  inspections: "Inspections / detentions",
  fleet: "Sister-fleet hits",
  flag: "Flag / identity",
}

/**
 * Which pipeline stages a check must re-run fresh. Every OTHER stage is seeded
 * from the baseline run (marked done) so the pipeline skips it. `sanctions`
 * notably re-runs only the sanctions stage — reusing the baseline's identity,
 * management and fleet — so a sanctions re-check makes ZERO calls to the
 * rate-limited registry scraper. `flag` is the one check that must re-identify.
 */
export const CHECK_STAGES: Record<MonitorCheck, VesselStageName[]> = {
  sanctions: ["sanctions"],
  ownership: ["ownership"],
  ais: ["ais"],
  inspections: ["inspections"],
  fleet: ["fleet"],
  flag: ["identify"],
}

/** Which snapshot facets a check governs when diffing (see WATCH_FACETS). */
export const CHECK_FACETS: Record<MonitorCheck, WatchFacet[]> = {
  sanctions: ["sanctions"],
  ownership: ["ownership", "inferredOwnership"],
  ais: ["ais"],
  inspections: ["inspections"],
  fleet: ["fleet"],
  flag: ["flag"],
}

/** Resolve a set of checks to the stages to run and the facets to compare. */
export function stagesForChecks(checks: MonitorCheck[]): VesselStageName[] {
  const set = new Set<VesselStageName>()
  for (const c of checks) for (const s of CHECK_STAGES[c]) set.add(s)
  return VESSEL_STAGE_NAMES.filter((s) => set.has(s))
}
export function facetsForChecks(checks: MonitorCheck[]): WatchFacet[] {
  const set = new Set<WatchFacet>(["verdict"])
  for (const c of checks) for (const f of CHECK_FACETS[c]) set.add(f)
  return WATCH_FACETS.filter((f) => set.has(f))
}

// ---- notify mode -----------------------------------------------------------
export const MONITOR_NOTIFY_MODES = ["all_changes", "escalations_only"] as const
export type MonitorNotifyMode = (typeof MONITOR_NOTIFY_MODES)[number]
export const monitorNotifyModeSchema = z.enum(MONITOR_NOTIFY_MODES)

export const MONITOR_TARGET_KINDS = ["vessel", "batch"] as const
export type MonitorTargetKind = (typeof MONITOR_TARGET_KINDS)[number]

// ---- create input (client → server) ----------------------------------------
export const createMonitorSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(200),
    targetKind: z.enum(MONITOR_TARGET_KINDS),
    /** Present for a single-vessel monitor. */
    imo: z.string().regex(/^\d{7}$/, "IMO must be 7 digits").optional(),
    /** Present for a batch monitor. */
    batchId: z.string().uuid().optional(),
    cadence: monitorCadenceSchema,
    /** Time of day (UTC, "HH:mm") the run should fire on its due date. */
    timeOfDay: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm").default("06:00"),
    checks: z.array(monitorCheckSchema).min(1, "Pick at least one check").default(["sanctions"]),
    notifyMode: monitorNotifyModeSchema.default("all_changes"),
  })
  .refine((v) => (v.targetKind === "vessel" ? !!v.imo : !!v.batchId), {
    message: "A vessel monitor needs an IMO; a batch monitor needs a batchId",
    path: ["targetKind"],
  })
export type CreateMonitorInput = z.infer<typeof createMonitorSchema>

/** In-place edits to a monitor's rule (schedule / checks / notify / enabled). */
export const updateMonitorSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  cadence: monitorCadenceSchema.optional(),
  timeOfDay: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  checks: z.array(monitorCheckSchema).min(1).optional(),
  notifyMode: monitorNotifyModeSchema.optional(),
  enabled: z.boolean().optional(),
})
export type UpdateMonitorInput = z.infer<typeof updateMonitorSchema>

// ---- read shapes (API → frontend) ------------------------------------------
export const MONITOR_RUN_STATUSES = ["running", "completed", "failed"] as const
export const monitorRunStatusSchema = z.enum(MONITOR_RUN_STATUSES)

export const monitorRunSchema = z.object({
  id: z.string(),
  monitorId: z.string(),
  status: monitorRunStatusSchema,
  /** Vessels evaluated in this run. */
  screeningCount: z.number(),
  /** Vessels whose watched facets changed in this run. */
  changedCount: z.number(),
  triggeredAt: z.string(),
  finishedAt: z.string().nullable(),
})
export type MonitorRun = z.infer<typeof monitorRunSchema>

export const monitorChangeSchema = z.object({
  id: z.string(),
  monitorId: z.string(),
  monitorRunId: z.string(),
  imo: z.string(),
  vesselName: z.string().nullable(),
  screeningId: z.string(),
  previousScreeningId: z.string().nullable(),
  changes: z.array(watchChangeSchema),
  /** True when any change in this set is an escalation (worsening). */
  escalation: z.boolean(),
  acknowledgedAt: z.string().nullable(),
  createdAt: z.string(),
})
export type MonitorChange = z.infer<typeof monitorChangeSchema>

export const monitorSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  targetKind: z.enum(MONITOR_TARGET_KINDS),
  imo: z.string().nullable(),
  batchId: z.string().nullable(),
  /** Vessels this monitor watches (1 for a vessel monitor, N for a batch). */
  vesselCount: z.number(),
  cadence: monitorCadenceSchema,
  timeOfDay: z.string(),
  checks: z.array(monitorCheckSchema),
  notifyMode: monitorNotifyModeSchema,
  enabled: z.boolean(),
  /** Soft-archived: hidden from the active list; scheduling is stopped. */
  archived: z.boolean().optional().default(false),
  nextRunAt: z.string().nullable(),
  lastRunAt: z.string().nullable(),
  /** Unacknowledged change records across all of this monitor's runs. */
  unacknowledgedChanges: z.number(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type MonitorSummary = z.infer<typeof monitorSummarySchema>

/** A monitor plus its run history + recent changes, for the detail page. */
export const monitorDetailSchema = monitorSummarySchema.extend({
  runs: z.array(monitorRunSchema),
  recentChanges: z.array(monitorChangeSchema),
})
export type MonitorDetail = z.infer<typeof monitorDetailSchema>
