/** Datalastic REST root. All endpoints are GET with an `api-key` query param. */
export const DEFAULT_BASE_URL = "https://api.datalastic.com/api/v0"

/** Per-request timeout. History/inradius calls can be heavier than a live lookup. */
export const DEFAULT_TIMEOUT_MS = 20000

/**
 * Minimum gap between requests. Requests are serialized so we never burst the
 * plan's rate limit and so credit spend stays deliberate. The upstream
 * ship-ingest default was 1 req/s; we keep that here.
 */
export const DEFAULT_MIN_REQUEST_INTERVAL_MS = 1000

/** Default look-back for {@link DatalasticClient.getVesselHistory} when no window is given. */
export const DEFAULT_HISTORY_DAYS = 90

/**
 * Credit cost is NOT flat per call — Datalastic bills "database requests":
 *   /vessel, /vessel_pro, /vessel_info        → 1 credit each
 *   /vessel_history                           → (days) × (1 vessel)
 *   /vessel_inradius                          → 1 credit per vessel returned, capped 500
 *   /inradius_history                         → (days) × (vessels/day), capped 500/day
 * A `/vessel_inradius` scan therefore returns at most this many vessels/credits.
 */
export const MAX_INRADIUS_VESSELS = 500
