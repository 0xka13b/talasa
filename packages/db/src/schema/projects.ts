import { pgEnum, pgTable, text, integer, timestamp, uuid, jsonb } from "drizzle-orm/pg-core"
import { PROJECT_STATUSES } from "@talasa/shared"
import { user } from "./auth"

export const projectStatus = pgEnum("project_status", [...PROJECT_STATUSES])

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  vesselName: text("vessel_name"),
  vesselImo: text("vessel_imo"),
  vesselMmsi: text("vessel_mmsi"),
  // Optional Equasis company IMO number — resolves the counterparty directly.
  companyImo: text("company_imo"),
  // Registered address of the picked Equasis company, from the search result.
  companyAddress: text("company_address"),
  counterpartyName: text("counterparty_name").notNull(),
  country: text("country"),
  role: text("role"),
  newsWindowDays: integer("news_window_days"),
  notes: text("notes"),
  status: projectStatus("status").notNull().default("draft"),
  brief: jsonb("brief"),
  error: text("error"),
  resolved: jsonb("resolved"),
  steps: jsonb("steps").notNull().default({}),
  progress: jsonb("progress"),
  modelMeta: jsonb("model_meta"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdBy: text("created_by").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})
