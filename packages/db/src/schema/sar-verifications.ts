import { boolean, integer, jsonb, pgTable, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { screenings } from "./screenings"

/**
 * Cache of on-demand Sentinel satellite verifications of a screening's AIS
 * events. One row per (screening, event index, palette): the verdict, the
 * annotation geometry, and the RAW chip (base64 PNG, no overlays — those are
 * drawn client-side). Lets a re-view or a chat/VLM reference cost 0 processing
 * units, and keeps the imagery as durable evidence. Cascades with the screening.
 */
export const sarVerifications = pgTable(
  "sar_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    screeningId: uuid("screening_id").notNull().references(() => screenings.id, { onDelete: "cascade" }),
    // Index into the screening's brief.ais.events array.
    eventIdx: integer("event_idx").notNull(),
    // "terrain" | "twopol" | "optical".
    palette: text("palette").notNull(),
    // True when an in-window Sentinel-1 pass existed at all.
    available: boolean("available").notNull(),
    verdict: text("verdict"),
    detail: text("detail"),
    sceneId: text("scene_id"),
    sceneDatetime: text("scene_datetime"),
    coverage: real("coverage"),
    // "sentinel-1" | "sentinel-2" — which mission the chip came from.
    sensor: text("sensor"),
    cloudCover: real("cloud_cover"),
    vesselLengthM: real("vessel_length_m"),
    vesselBeamM: real("vessel_beam_m"),
    targetCount: integer("target_count"),
    contactCount: integer("contact_count").notNull().default(0),
    // { distanceM, lengthM, widthM } of the matched hull.
    primarySummary: jsonb("primary_summary"),
    aisFix: jsonb("ais_fix"),
    primaryTarget: jsonb("primary_target"),
    contacts: jsonb("contacts").notNull().default([]),
    imageBbox: jsonb("image_bbox"),
    imageSize: jsonb("image_size"),
    // Base64 PNG of the raw chip (no annotations).
    image: text("image"),
    // Full PU billed for this verification (detection raster + display chip).
    processingUnits: real("processing_units"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("sar_verifications_screening_event_palette_key").on(t.screeningId, t.eventIdx, t.palette)],
)
