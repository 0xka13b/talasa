import { pgTable, text, timestamp, uuid, jsonb, boolean } from "drizzle-orm/pg-core"
import type { WatchSnapshot } from "@talasa/shared"
import { projectStatus } from "./projects"
import { batches } from "./batches"
import { monitors, monitorRuns } from "./monitors"
import { user } from "./auth"

export const screenings = pgTable("screenings", {
  id: uuid("id").primaryKey().defaultRandom(),
  // User-supplied label so a screening is recognizable before/independent of the
  // vessel name resolved from the IMO by the pipeline.
  name: text("name").notNull(),
  imo: text("imo").notNull(),
  // Set when this screening was created as part of an uploaded batch (a set);
  // null for a one-off screening. Cascades so deleting a batch removes its members.
  batchId: uuid("batch_id").references(() => batches.id, { onDelete: "cascade" }),
  // Set when this screening is a run of a recurring monitor. `monitorId` cascades
  // (deleting a monitor removes its generated evaluation rows); `monitorRunId`
  // groups the members of one scheduled execution.
  monitorId: uuid("monitor_id").references(() => monitors.id, { onDelete: "cascade" }),
  monitorRunId: uuid("monitor_run_id").references(() => monitorRuns.id, { onDelete: "set null" }),
  // Canonical change-detection projection of this run's brief + its fingerprint,
  // computed at synthesize time so the next run can diff against it cheaply.
  watchSnapshot: jsonb("watch_snapshot").$type<WatchSnapshot>(),
  watchHash: text("watch_hash"),
  status: projectStatus("status").notNull().default("draft"),
  vesselName: text("vessel_name"),
  flag: text("flag"),
  identity: jsonb("identity"),
  graph: jsonb("graph"),
  // User's saved relationship-graph board overlay (node positions + annotations).
  graphBoard: jsonb("graph_board"),
  brief: jsonb("brief"),
  steps: jsonb("steps").notNull().default({}),
  progress: jsonb("progress"),
  modelMeta: jsonb("model_meta"),
  error: text("error"),
  // Soft-archive: hidden from the active sidebar list but retained in the DB
  // (a future "Archived" view will surface these).
  archived: boolean("archived").notNull().default(false),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdBy: text("created_by").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})
