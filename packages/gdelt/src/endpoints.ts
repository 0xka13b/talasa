import { DEFAULT_MAX_RECORDS, MAX_RECORDS_LIMIT } from "./constants"
import { GdeltConfigError } from "./errors"
import type { ArticleSearchOptions, ArticleSort, ScreenEntityOptions } from "./types"

/** Maps our friendly sort names to GDELT's `sort` parameter values. */
const SORT_PARAM: Record<ArticleSort, string> = {
  date: "DateDesc",
  dateAsc: "DateAsc",
  tone: "ToneDesc",
  toneAsc: "ToneAsc",
  relevance: "HybridRel",
}

/** Build the query string for a DOC `ArtList` request. */
export function artListParams(options: ArticleSearchOptions): URLSearchParams {
  const query = options.query.trim()
  if (!query) {
    throw new GdeltConfigError("query must not be empty")
  }

  const params = new URLSearchParams()
  params.set("query", query)
  params.set("mode", "ArtList")
  params.set("format", "json")
  params.set("maxrecords", String(clampRecords(options.maxRecords)))
  params.set("sort", SORT_PARAM[options.sort ?? "date"])

  // Explicit window wins over the relative timespan.
  if (options.startDate !== undefined || options.endDate !== undefined) {
    if (options.startDate !== undefined) {
      params.set("startdatetime", toGdeltStamp(options.startDate))
    }
    if (options.endDate !== undefined) {
      params.set("enddatetime", toGdeltStamp(options.endDate))
    }
  } else if (options.timespan) {
    params.set("timespan", options.timespan)
  }

  return params
}

/**
 * Compose a GDELT query for one entity: the name as an exact phrase, plus
 * optional adverse-tone / language / country filters. Multi-word names MUST be
 * quoted, otherwise GDELT ANDs the bare words across unrelated articles.
 */
export function entityQuery(name: string, options: ScreenEntityOptions = {}): string {
  const cleaned = name.trim()
  if (!cleaned) {
    throw new GdeltConfigError("entity name must not be empty")
  }

  const terms: string[] = [phrase(cleaned)]
  if (options.maxTone !== undefined) {
    terms.push(`tone<${options.maxTone}`)
  }
  if (options.sourceLang) {
    terms.push(`sourcelang:${options.sourceLang.trim()}`)
  }
  if (options.sourceCountry) {
    terms.push(`sourcecountry:${options.sourceCountry.trim()}`)
  }
  return terms.join(" ")
}

/** Wrap a value in quotes for an exact-phrase match, escaping embedded quotes. */
function phrase(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`
}

function clampRecords(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_MAX_RECORDS
  }
  return Math.max(1, Math.min(Math.trunc(value), MAX_RECORDS_LIMIT))
}

/** Convert a `Date` or pre-formatted string to GDELT's `YYYYMMDDHHMMSS` stamp. */
function toGdeltStamp(value: string | Date): string {
  if (typeof value === "string") {
    return value.trim()
  }
  const iso = value.toISOString() // 2026-06-01T12:00:00.000Z
  return iso.slice(0, 19).replace(/[-:T]/g, "")
}
