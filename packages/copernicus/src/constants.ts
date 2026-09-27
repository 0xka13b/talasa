/**
 * Copernicus Data Space Ecosystem (CDSE) endpoints.
 *
 * Auth is OAuth2 client-credentials (not a query-param API key): mint a Client
 * ID + Secret in the CDSE dashboard, exchange them at {@link TOKEN_ENDPOINT} for
 * a bearer token, and send it on every Sentinel Hub call.
 */

/** OAuth2 token endpoint (Keycloak, CDSE realm). POST client_credentials here. */
export const TOKEN_ENDPOINT =
  "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"

/** Sentinel Hub service root on CDSE. */
export const DEFAULT_BASE_URL = "https://sh.dataspace.copernicus.eu"

/** Catalog (STAC) search path — FREE (no processing units). Use it to confirm a
 * scene exists over an AOI/date before spending PUs on {@link PROCESS_PATH}. */
export const CATALOG_SEARCH_PATH = "/api/v1/catalog/1.0.0/search"

/** Process API path — PU-metered. Returns rendered image bytes for an AOI+time. */
export const PROCESS_PATH = "/api/v1/process"

/** Per-request timeout. Process calls (raster rendering) are heavier than a search. */
export const DEFAULT_TIMEOUT_MS = 60000

/**
 * Minimum gap between requests. Sentinel Hub rate-limits per account and the
 * token endpoint is separately rate-limited; serializing keeps us well under
 * both and makes PU spend deliberate, one request at a time.
 */
export const DEFAULT_MIN_REQUEST_INTERVAL_MS = 500

/** Refresh the token this many seconds BEFORE its `exp`, to avoid edge expiry. */
export const TOKEN_EXPIRY_SKEW_S = 60

/**
 * Sentinel Hub data collection identifiers (the `data[].type` field in a Process
 * or Catalog request). Sentinel-1 GRD is the all-weather, day/night SAR product
 * used for dark-vessel detection; Sentinel-2 L2A is surface-reflectance optical.
 */
export const COLLECTION = {
  /** Sentinel-1 Ground Range Detected — SAR. The workhorse for dark-ship detection. */
  sentinel1Grd: "sentinel-1-grd",
  /** Sentinel-2 Level-2A — atmospherically corrected optical (10m visible bands). */
  sentinel2L2a: "sentinel-2-l2a",
} as const

export type CollectionId = (typeof COLLECTION)[keyof typeof COLLECTION]

/**
 * Response header Sentinel Hub sets with the processing-unit cost of the call.
 * We surface it so callers can track free-tier quota spend.
 */
export const PU_HEADER = "x-processingunits-spent"
