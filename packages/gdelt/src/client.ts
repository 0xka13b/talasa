import { DEFAULT_BASE_URL, DEFAULT_TIMESPAN } from "./constants"
import { artListParams, entityQuery } from "./endpoints"
import { getDoc } from "./http"
import type { TransportConfig } from "./http"
import { toArticle } from "./map"
import { artListResponseSchema } from "./types"
import type { Article, ArticleSearchOptions, EntityMediaCoverage, ScreenEntityOptions } from "./types"

export interface GdeltClientConfig {
  /** Override the API root. Defaults to the public DOC endpoint. */
  baseUrl?: string
}

/**
 * Typed client over GDELT's free DOC 2.0 article API
 * (`https://api.gdeltproject.org/api/v2/doc/doc`). No auth, no key — it returns
 * raw global-news articles mentioning an entity, the adverse-media candidate set
 * for the Counterparty DD brief. Relevance/adverseness is a downstream (LLM)
 * judgement; nothing is asserted here (results are *suspected / unverified*).
 *
 * ## Concurrency / rate limit
 *
 * The public DOC endpoint allows **at most 1 request every ~5 seconds per IP**.
 * This client does NOT throttle for you — issue calls serially and space them
 * out (e.g. one entity per job tick, never `Promise.all` across entities).
 * Exceeding the limit makes GDELT return a plain-text notice (often at HTTP
 * 200), which surfaces here as {@link GdeltRateLimitError} — not silent
 * "0 results". If you need higher throughput, contact GDELT for a larger quota.
 */
export class GdeltClient {
  private readonly config: TransportConfig

  constructor(config: GdeltClientConfig = {}) {
    this.config = { baseUrl: config.baseUrl ?? DEFAULT_BASE_URL }
  }

  /** Low-level full-text article search over a raw GDELT query expression. */
  async searchArticles(options: ArticleSearchOptions): Promise<Article[]> {
    const withWindow: ArticleSearchOptions =
      options.timespan || options.startDate || options.endDate
        ? options
        : { ...options, timespan: DEFAULT_TIMESPAN }
    const body = await getDoc(this.config, artListParams(withWindow))
    return artListResponseSchema.parse(body).articles.map(toArticle)
  }

  /**
   * Media scan for one entity by name. Builds an exact-phrase query (plus any
   * adverse-tone / language / country filters) and returns matching articles
   * ordered with the harshest coverage first by default.
   */
  async screenEntity(name: string, options: ScreenEntityOptions = {}): Promise<EntityMediaCoverage> {
    const query = entityQuery(name, options)
    const articles = await this.searchArticles({
      query,
      timespan: options.startDate || options.endDate ? undefined : (options.timespan ?? DEFAULT_TIMESPAN),
      startDate: options.startDate,
      endDate: options.endDate,
      maxRecords: options.maxRecords,
      sort: options.sort ?? "toneAsc",
    })
    return { query, articles }
  }
}
