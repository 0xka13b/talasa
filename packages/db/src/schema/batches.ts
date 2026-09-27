import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core"
import { user } from "./auth"

/**
 * A batch is a first-class SET of vessel screenings created together from an
 * uploaded CSV/Excel list. It owns nothing but its label + owner; each member is
 * a normal `screenings` row pointing back via `batch_id`, so a batch member runs
 * through the exact same pipeline as a one-off screening. Aggregate progress
 * (done/running/failed) is derived from the members, not stored here. This is
 * also the entity the upcoming Monitoring rules will attach to.
 */
export const batches = pgTable("batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Soft-archive: hidden from the active list; members are retained. Archiving a
  // batch also disables any monitor targeting it (see archiveBatch).
  archived: boolean("archived").notNull().default(false),
  createdBy: text("created_by").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})
