import { pgTable, text, timestamp, uuid, jsonb, boolean } from "drizzle-orm/pg-core"
import type { WatchChange } from "@talasa/shared"
import { monitors, monitorRuns } from "./monitors"
import { screenings } from "./screenings"

/**
 * A detected change on one vessel in one monitor run — the row that powers the
 * in-app change feed and (later) notifications. `changes` is the facet-scoped
 * human diff; `escalation` mirrors whether any of them is a worsening. Kept in a
 * leaf module so `screenings` can reference `monitors` without an import cycle.
 */
export const monitorChanges = pgTable("monitor_changes", {
  id: uuid("id").primaryKey().defaultRandom(),
  monitorId: uuid("monitor_id").notNull().references(() => monitors.id, { onDelete: "cascade" }),
  monitorRunId: uuid("monitor_run_id").notNull().references(() => monitorRuns.id, { onDelete: "cascade" }),
  imo: text("imo").notNull(),
  vesselName: text("vessel_name"),
  /** The run that produced this change. */
  screeningId: uuid("screening_id").references(() => screenings.id, { onDelete: "set null" }),
  /** The baseline screening it was compared against. */
  previousScreeningId: uuid("previous_screening_id").references(() => screenings.id, { onDelete: "set null" }),
  changes: jsonb("changes").$type<WatchChange[]>().notNull().default([]),
  escalation: boolean("escalation").notNull().default(false),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})
