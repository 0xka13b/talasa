import { pgTable, text, timestamp, uuid, jsonb, boolean, integer } from "drizzle-orm/pg-core"
import type { MonitorCheck } from "@talasa/shared"
import { user } from "./auth"
import { batches } from "./batches"

/**
 * A monitor is a saved RULE for recurring screening: re-run a vessel (or a batch)
 * on a cadence, executing only the selected `checks`, and diff each run against
 * the previous one. Each run creates fresh `screenings` rows (tagged back via
 * `monitor_id` / `monitor_run_id`) so a monitor member flows through the exact
 * same pipeline as any screening — it is simply re-run on a schedule and diffed.
 */
export const monitors = pgTable("monitors", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** "vessel" (single IMO) or "batch" (every distinct IMO in a batch). */
  targetKind: text("target_kind").notNull(),
  imo: text("imo"),
  batchId: uuid("batch_id").references(() => batches.id, { onDelete: "cascade" }),
  cadence: text("cadence").notNull(),
  /** Time of day (UTC, "HH:mm") the run fires on its due date. */
  timeOfDay: text("time_of_day").notNull().default("06:00"),
  /** Which checks to re-run + compare each run (see MONITOR_CHECKS). */
  checks: jsonb("checks").$type<MonitorCheck[]>().notNull().default(["sanctions"]),
  notifyMode: text("notify_mode").notNull().default("all_changes"),
  enabled: boolean("enabled").notNull().default(true),
  /** When the scheduler should next fire this monitor; null disables scheduling. */
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  // Soft-archive: hidden from the active list. Archiving also sets enabled=false
  // and next_run_at=null so the scheduler never fires it again (see archiveMonitor).
  archived: boolean("archived").notNull().default(false),
  createdBy: text("created_by").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

/** One scheduled execution of a monitor — the parent of the screenings it spawned
 * and the change records they produced. Counts are aggregated as members finish. */
export const monitorRuns = pgTable("monitor_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  monitorId: uuid("monitor_id").notNull().references(() => monitors.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("running"),
  screeningCount: integer("screening_count").notNull().default(0),
  changedCount: integer("changed_count").notNull().default(0),
  triggeredAt: timestamp("triggered_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
})
