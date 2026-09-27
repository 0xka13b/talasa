import { z } from "zod"
import type { CollectionId } from "./constants"

/**
 * A geographic bounding box in WGS84 lon/lat, ordered `[west, south, east,
 * north]` — the same order Sentinel Hub and the STAC spec use.
 */
export type BBox = [west: number, south: number, east: number, north: number]

/** An inclusive time window as ISO-8601 instants (e.g. `2026-01-01T00:00:00Z`). */
export interface TimeRange {
  from: string
  to: string
}

// ---- Catalog (STAC) ----

/** Raw STAC item (lenient — we only read the fields we surface). */
export const stacItemSchema = z
  .object({
    id: z.string(),
    collection: z.string().nullable().optional(),
    bbox: z.array(z.number()).nullable().optional(),
    properties: z
      .object({
        datetime: z.string().nullable().optional(),
        "eo:cloud_cover": z.number().nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough()

/** Raw STAC `POST /search` response (a FeatureCollection with paging context). */
export const stacSearchResponseSchema = z
  .object({
    features: z.array(stacItemSchema).default([]),
    context: z
      .object({ returned: z.number().optional(), next: z.number().nullable().optional() })
      .passthrough()
      .optional(),
  })
  .passthrough()

export type RawStacItem = z.infer<typeof stacItemSchema>
export type RawStacSearchResponse = z.infer<typeof stacSearchResponseSchema>

/** A trimmed catalog hit: one available scene over the queried AOI/time. */
export interface CatalogScene {
  /** Product identifier, usable to narrow a later Process request to this scene. */
  id: string
  collection: string | null
  /** Acquisition instant (ISO-8601), or null if the item omitted it. */
  datetime: string | null
  bbox: number[] | null
  /** Optical cloud cover % (Sentinel-2 only); null for SAR/absent. */
  cloudCover: number | null
}

// ---- Process ----

/** Output raster format for a Process request. */
export type ImageFormat = "image/png" | "image/tiff" | "image/jpeg"

/** The bytes returned by a Process call, plus the processing-unit cost it billed. */
export interface ProcessResult {
  /** Raw image bytes in the requested {@link ImageFormat}. */
  image: Uint8Array
  contentType: string
  /** Processing units this call spent (from the response header), or null if absent. */
  processingUnits: number | null
}

// ---- Request shapes surfaced by the client ----

/** A catalog search over an AOI + time window for one collection. */
export interface CatalogQuery {
  collection: CollectionId
  bbox: BBox
  time: TimeRange
  /** Max items to return (server may page; we fetch the first page). Default 50. */
  limit?: number
}

/**
 * A Process request: render `bbox` at `time` through `evalscript` into an image.
 * `width`/`height` set the output raster size in pixels — cost scales with them,
 * so keep AOIs small and resolution matched to the task.
 */
export interface ProcessQuery {
  collection: CollectionId
  bbox: BBox
  time: TimeRange
  /** A Sentinel Hub evalscript (v3). See {@link module:evalscripts}. */
  evalscript: string
  width: number
  height: number
  format?: ImageFormat
}
