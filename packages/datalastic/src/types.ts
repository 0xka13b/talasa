import { z } from "zod"

// ---- Request selector: exactly one of uuid / imo / mmsi identifies a vessel ----
export type VesselSelector = { uuid: string } | { imo: string } | { mmsi: string }

// ---- Raw API schemas (lenient: Datalastic nulls/omits freely and mixes number/string) ----

/** Numeric-ish field that may arrive as a number, a numeric string, null, or absent. */
const numish = z.union([z.number(), z.string()]).nullable().optional()
/** Identifier field that may arrive as a number or string (mmsi/imo/eni). */
const idish = z.union([z.string(), z.number()]).nullable().optional()
/** nav status arrives as a code (number) or a label (string) depending on endpoint. */
const navish = z.union([z.string(), z.number()]).nullable().optional()

/** Identity fields shared across every vessel endpoint. */
const identityShape = {
  uuid: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  name_ais: z.string().nullable().optional(),
  mmsi: idish,
  imo: idish,
  eni: idish,
  country_iso: z.string().nullable().optional(),
  country_name: z.string().nullable().optional(),
  callsign: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  type_specific: z.string().nullable().optional(),
}

/** A single AIS fix inside a `/vessel_history` track. */
export const rawPositionSchema = z
  .object({
    lat: numish,
    lon: numish,
    speed: numish,
    course: numish,
    heading: numish,
    navigation_status: navish,
    destination: z.string().nullable().optional(),
    last_position_epoch: numish,
    last_position_UTC: z.string().nullable().optional(),
  })
  .passthrough()

/** `/vessel` and `/vessel_pro` (`current_draught` etc. are pro-only). */
export const rawVesselLiveSchema = z
  .object({
    ...identityShape,
    lat: numish,
    lon: numish,
    speed: numish,
    course: numish,
    heading: numish,
    navigation_status: navish,
    destination: z.string().nullable().optional(),
    dest_port: z.string().nullable().optional(),
    dest_port_unlocode: z.string().nullable().optional(),
    eta_UTC: z.string().nullable().optional(),
    eta_epoch: numish,
    // pro-only
    current_draught: numish,
    draught: numish,
    atd_UTC: z.string().nullable().optional(),
    last_position_epoch: numish,
    last_position_UTC: z.string().nullable().optional(),
  })
  .passthrough()

/** `/vessel_info` — static ship specifications. */
export const rawVesselInfoSchema = z
  .object({
    ...identityShape,
    gross_tonnage: numish,
    deadweight: numish,
    teu: numish,
    liquid_gas: numish,
    length: numish,
    breadth: numish,
    draught_avg: numish,
    draught_max: numish,
    speed_avg: numish,
    speed_max: numish,
    year_built: idish,
    home_port: z.string().nullable().optional(),
    is_navaid: z.boolean().nullable().optional(),
  })
  .passthrough()

/** `/vessel_history` — identity + the ordered position track. */
export const rawVesselHistorySchema = z
  .object({
    ...identityShape,
    positions: z.array(rawPositionSchema).default([]),
  })
  .passthrough()

/** One vessel in a `/vessel_inradius` scan (identity + current fix + distance to centre). */
export const rawRadiusVesselSchema = z
  .object({
    ...identityShape,
    lat: numish,
    lon: numish,
    speed: numish,
    course: numish,
    heading: numish,
    navigation_status: navish,
    destination: z.string().nullable().optional(),
    distance: numish,
    last_position_epoch: numish,
    last_position_UTC: z.string().nullable().optional(),
  })
  .passthrough()

/** `/vessel_inradius` payload. */
export const rawInRadiusSchema = z
  .object({
    point: z
      .object({ lat: numish, lon: numish, radius: numish })
      .passthrough()
      .nullable()
      .optional(),
    total: numish,
    vessels: z.array(rawRadiusVesselSchema).default([]),
  })
  .passthrough()

/** Datalastic wraps every payload as `{ data, meta }`. */
export const metaSchema = z
  .object({
    duration: numish,
    endpoint: z.string().nullable().optional(),
    success: z.boolean().nullable().optional(),
  })
  .passthrough()

const envelope = <T extends z.ZodTypeAny>(data: T) =>
  z.object({ data: data.nullable(), meta: metaSchema.optional() }).passthrough()

export const vesselLiveResponseSchema = envelope(rawVesselLiveSchema)
export const vesselInfoResponseSchema = envelope(rawVesselInfoSchema)
export const vesselHistoryResponseSchema = envelope(rawVesselHistorySchema)
export const inRadiusResponseSchema = envelope(rawInRadiusSchema)

export type RawPosition = z.infer<typeof rawPositionSchema>
export type RawVesselLive = z.infer<typeof rawVesselLiveSchema>
export type RawVesselInfo = z.infer<typeof rawVesselInfoSchema>
export type RawVesselHistory = z.infer<typeof rawVesselHistorySchema>
export type RawRadiusVessel = z.infer<typeof rawRadiusVesselSchema>
export type RawInRadius = z.infer<typeof rawInRadiusSchema>

// ---- Trimmed domain types (only the valuable fields, coerced to clean shapes) ----

/** Core identity carried by every response. */
export interface VesselIdentityCore {
  uuid: string | null
  name: string | null
  mmsi: string | null
  imo: string | null
  countryIso: string | null
  type: string | null
  typeSpecific: string | null
}

/** One AIS position fix. `epoch` is unix seconds; `timeUtc` is Datalastic's UTC string. */
export interface VesselPosition {
  lat: number | null
  lon: number | null
  speed: number | null
  course: number | null
  heading: number | null
  navStatus: string | null
  destination: string | null
  epoch: number | null
  timeUtc: string | null
}

/** Live position from `/vessel` (basic) or `/vessel_pro` (adds `currentDraught`/ETA). */
export interface VesselLive extends VesselIdentityCore {
  position: VesselPosition
  destination: string | null
  destPort: string | null
  etaUtc: string | null
  /** Current AIS draught — only populated by `/vessel_pro`. A load/discharge proxy. */
  currentDraught: number | null
}

/** Static specs from `/vessel_info`. */
export interface VesselSpecs extends VesselIdentityCore {
  callSign: string | null
  countryName: string | null
  grossTonnage: number | null
  deadweight: number | null
  length: number | null
  breadth: number | null
  draughtMax: number | null
  yearBuilt: string | null
  homePort: string | null
}

/** Historical AIS track from `/vessel_history` — the input for gap / port-call / STS derivation. */
export interface VesselTrack extends VesselIdentityCore {
  positions: VesselPosition[]
}

/** One vessel in a radius scan, with its distance from the query centre. */
export interface RadiusVessel extends VesselIdentityCore {
  position: VesselPosition
  /** Distance from the scan centre, in nautical miles (as reported by Datalastic). */
  distanceNm: number | null
}

/** Result of a `/vessel_inradius` scan. */
export interface RadiusScan {
  center: { lat: number | null; lon: number | null; radiusNm: number | null }
  total: number | null
  vessels: RadiusVessel[]
}
