export { EquasisClient } from "./client"
export type { EquasisClientConfig } from "./client"

export {
  shipInfoSchema,
  shipParticularsSchema,
  shipOverviewSchema,
  managementEntrySchema,
  geographyEntrySchema,
  inspectionSchema,
  shipInspectionsSchema,
  historyEntrySchema,
  shipHistorySchema,
  companyResultSchema,
  fleetVesselRefSchema,
  companyFleetSchema,
} from "./types"
export type {
  ShipInfo,
  ShipParticulars,
  ShipOverview,
  ManagementEntry,
  GeographyEntry,
  Inspection,
  ShipInspections,
  HistoryEntry,
  ShipHistory,
  CompanyResult,
  FleetVesselRef,
  CompanyFleet,
} from "./types"

export {
  EquasisError,
  EquasisHttpError,
  SessionExpiredError,
  NotFoundError,
  ParseError,
} from "./errors"
