/** GDELT 2.0 DOC API root. The article-search endpoint lives at `/api/v2/doc/doc`. */
export const DEFAULT_BASE_URL = "https://api.gdeltproject.org"

/** Path of the DOC 2.0 full-text article API. */
export const DOC_PATH = "/api/v2/doc/doc"

/** Default number of articles to return (DOC caps `maxrecords` at 250). */
export const DEFAULT_MAX_RECORDS = 50

/** Hard cap the DOC API enforces on `maxrecords`. */
export const MAX_RECORDS_LIMIT = 250

/**
 * Default lookback window for an entity media scan. Expressed in GDELT's
 * `timespan` grammar (e.g. `3m`, `1w`, `24h`). The DOC index covers a rolling
 * window of recent news; widen with `startDate`/`endDate` for explicit ranges.
 */
export const DEFAULT_TIMESPAN = "3m"
