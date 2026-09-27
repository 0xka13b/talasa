export { DatalasticClient } from "./client"
export type { DatalasticClientConfig, RadiusScanQuery } from "./client"

export type { HistoryWindow, RadiusQuery, TransportConfig } from "./http"

export {
  mapRadiusScan,
  mapVesselInfo,
  mapVesselLive,
  mapVesselTrack,
  num,
  str,
} from "./map"

export {
  inRadiusResponseSchema,
  metaSchema,
  rawInRadiusSchema,
  rawPositionSchema,
  rawRadiusVesselSchema,
  rawVesselHistorySchema,
  rawVesselInfoSchema,
  rawVesselLiveSchema,
  vesselHistoryResponseSchema,
  vesselInfoResponseSchema,
  vesselLiveResponseSchema,
} from "./types"
export type {
  RadiusScan,
  RadiusVessel,
  RawInRadius,
  RawPosition,
  RawRadiusVessel,
  RawVesselHistory,
  RawVesselInfo,
  RawVesselLive,
  VesselIdentityCore,
  VesselLive,
  VesselPosition,
  VesselSelector,
  VesselSpecs,
  VesselTrack,
} from "./types"

export {
  DEFAULT_BASE_URL,
  DEFAULT_HISTORY_DAYS,
  DEFAULT_MIN_REQUEST_INTERVAL_MS,
  DEFAULT_TIMEOUT_MS,
  MAX_INRADIUS_VESSELS,
} from "./constants"

export {
  DatalasticAuthError,
  DatalasticConfigError,
  DatalasticError,
  DatalasticHttpError,
  DatalasticRateLimitError,
  DatalasticTimeoutError,
} from "./errors"
