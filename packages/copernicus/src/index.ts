export { CopernicusClient, bboxAround } from "./client"
export type { CopernicusClientConfig, SarChipQuery } from "./client"

export { TokenManager } from "./auth"
export type { TokenManagerConfig } from "./auth"

export { searchCatalog } from "./catalog"
export { runProcess } from "./process"

export { detectTargets } from "./detect"
export type {
  DetectInput,
  DetectOptions,
  DetectResult,
  SarTarget,
  WaterStats,
} from "./detect"

export { decodeSigma0Tiff, fetchDetectionRaster } from "./raster"
export type { Sigma0Raster } from "./raster"

export { correlateStsCandidate, haversineM } from "./correlate"
export type {
  CorrelateOptions,
  StsCandidateSite,
  StsCorrelation,
  StsVerdict,
} from "./correlate"

export { verifyStsCandidate } from "./verify"
export type { StsVerification, StsVerificationRequest } from "./verify"

export {
  S1_SAR_TERRAIN,
  S1_SIGMA0_LINEAR,
  S1_VV_GRAYSCALE,
  S1_VV_VH_FALSE_COLOUR,
  S2_TRUE_COLOUR,
} from "./evalscripts"

export {
  CATALOG_SEARCH_PATH,
  COLLECTION,
  DEFAULT_BASE_URL,
  DEFAULT_MIN_REQUEST_INTERVAL_MS,
  DEFAULT_TIMEOUT_MS,
  PROCESS_PATH,
  PU_HEADER,
  TOKEN_ENDPOINT,
} from "./constants"
export type { CollectionId } from "./constants"

export {
  stacItemSchema,
  stacSearchResponseSchema,
} from "./types"
export type {
  BBox,
  CatalogQuery,
  CatalogScene,
  ImageFormat,
  ProcessQuery,
  ProcessResult,
  RawStacItem,
  RawStacSearchResponse,
  TimeRange,
} from "./types"

export {
  CopernicusAuthError,
  CopernicusConfigError,
  CopernicusError,
  CopernicusHttpError,
  CopernicusRateLimitError,
  CopernicusTimeoutError,
  CopernicusTokenError,
} from "./errors"
