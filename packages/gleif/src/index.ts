export { GleifClient } from "./client"
export type { GleifClientConfig } from "./client"

export {
  mapFuzzyMatches,
  mapLeiRecord,
  matchConfidence,
  normalizeName,
  toOwnershipLink,
} from "./map"

export { leiRecordSchema, leiRecordResponseSchema, fuzzyResponseSchema } from "./types"
export type {
  LeiRecord,
  FuzzyMatch,
  GleifAddress,
  GleifCompany,
  GleifNameMatch,
  GleifOwnershipLink,
  GleifCompanyProfile,
} from "./types"

export {
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MIN_REQUEST_INTERVAL_MS,
  DEFAULT_FUZZY_LIMIT,
} from "./constants"

export {
  GleifError,
  GleifConfigError,
  GleifHttpError,
  GleifRateLimitError,
  GleifTimeoutError,
} from "./errors"
