import { z } from "zod"

/** Identity + technical particulars of a vessel. */
export const shipParticularsSchema = z.object({
  imo: z.string(),
  name: z.string(),
  flag: z.string().nullable(),
  callSign: z.string().nullable(),
  mmsi: z.string().nullable(),
  grossTonnage: z.number().nullable(),
  deadweight: z.number().nullable(),
  shipType: z.string().nullable(),
  yearOfBuild: z.string().nullable(),
  status: z.string().nullable(),
  lastUpdate: z.string().nullable(),
})
export type ShipParticulars = z.infer<typeof shipParticularsSchema>

/** Risk/compliance summary shown on the ship page header. */
export const shipOverviewSchema = z.object({
  classedByIacs: z.boolean(),
  detentionRate: z.string().nullable(),
  parisMou: z.string().nullable(),
  tokyoMou: z.string().nullable(),
  usCoastGuard: z.string().nullable(),
})
export type ShipOverview = z.infer<typeof shipOverviewSchema>

/** One company in a ship's management/ownership chain. */
export const managementEntrySchema = z.object({
  companyImo: z.string().nullable(),
  role: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  dateOfEffect: z.string().nullable(),
})
export type ManagementEntry = z.infer<typeof managementEntrySchema>

/**
 * One row of the ShipInfo "Geographical Information" table — a recent sighting of
 * the vessel in a broad maritime zone, attributed to a tracking source.
 */
export const geographyEntrySchema = z.object({
  /** "Date of record" — a coarse month/year, as Equasis renders it (e.g. "June 2026"), or null. */
  date: z.string().nullable(),
  /** "Area where the ship was seen" — one or more comma-separated zones (e.g. "East Asia, South East Asia"), or null. */
  area: z.string().nullable(),
  /** "Source" of the sighting (e.g. "MarineTraffic", "VesselTracker", "AXS Marine"), or null. */
  source: z.string().nullable(),
})
export type GeographyEntry = z.infer<typeof geographyEntrySchema>

/** Full result of a ship-by-IMO lookup. */
export const shipInfoSchema = z.object({
  particulars: shipParticularsSchema,
  overview: shipOverviewSchema,
  management: z.array(managementEntrySchema),
  /** Recent sightings by broad maritime zone (the "Geographical Information" section). */
  geography: z.array(geographyEntrySchema),
})
export type ShipInfo = z.infer<typeof shipInfoSchema>

/** One port-state-control (PSC) inspection event from a ship's inspection history. */
export const inspectionSchema = z.object({
  /** Inspecting authority / country (e.g. "Romania"), or null on older rows. */
  authority: z.string().nullable(),
  /** Date of report, as Equasis renders it (DD/MM/YYYY), or null. */
  date: z.string().nullable(),
  /** Port of inspection, or null. */
  port: z.string().nullable(),
  /** Whether the inspection led to a detention. */
  detained: z.boolean(),
  /** Number of deficiencies recorded, or null when none reported. */
  deficiencies: z.number().nullable(),
})
export type Inspection = z.infer<typeof inspectionSchema>

/** A vessel's full PSC inspection history. */
export const shipInspectionsSchema = z.object({
  imo: z.string(),
  inspections: z.array(inspectionSchema),
})
export type ShipInspections = z.infer<typeof shipInspectionsSchema>

/**
 * One change in a vessel's history (a name, flag, classification society, or
 * company-role change). Equasis records the date a value became effective, not
 * when it ended, so {@link HistoryEntry.to} is currently always null.
 */
export const historyEntrySchema = z.object({
  /** Category of change: "name", "flag", "class", or the company role (e.g. "Registered owner"). */
  kind: z.string(),
  /** The changed value — ship name, flag state, society, or company name. */
  value: z.string().nullable(),
  /** Date the value became effective (DD/MM/YYYY), or null. */
  from: z.string().nullable(),
  /** Date the value ceased to apply, or null (Equasis records only start dates). */
  to: z.string().nullable(),
})
export type HistoryEntry = z.infer<typeof historyEntrySchema>

/** A vessel's full change history (name / flag / class / company roles over time). */
export const shipHistorySchema = z.object({
  imo: z.string(),
  entries: z.array(historyEntrySchema),
})
export type ShipHistory = z.infer<typeof shipHistorySchema>

/** One row of a company search result list. */
export const companyResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().nullable(),
})
export type CompanyResult = z.infer<typeof companyResultSchema>

/** One vessel row from a company's fleet listing. */
export const fleetVesselRefSchema = z.object({
  imo: z.string(),
  name: z.string().nullable(),
  flag: z.string().nullable(),
  type: z.string().nullable(),
})
export type FleetVesselRef = z.infer<typeof fleetVesselRefSchema>

/** A company's fleet (vessels under its ownership/management). */
export const companyFleetSchema = z.object({
  companyImo: z.string(),
  name: z.string(),
  vessels: z.array(fleetVesselRefSchema),
})
export type CompanyFleet = z.infer<typeof companyFleetSchema>
