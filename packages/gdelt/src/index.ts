export { GdeltClient } from "./client"
export type { GdeltClientConfig } from "./client"

export { toArticle } from "./map"
export { artListParams, entityQuery } from "./endpoints"

export { articleItemSchema, artListResponseSchema } from "./types"
export type {
  ArticleItem,
  ArtListResponse,
  Article,
  EntityMediaCoverage,
  ArticleSort,
  ArticleSearchOptions,
  ScreenEntityOptions,
} from "./types"

export { DEFAULT_BASE_URL, DOC_PATH, DEFAULT_MAX_RECORDS, DEFAULT_TIMESPAN } from "./constants"

export {
  GdeltError,
  GdeltConfigError,
  GdeltHttpError,
  GdeltRateLimitError,
  GdeltQueryError,
} from "./errors"
