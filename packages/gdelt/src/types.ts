import { z } from "zod"

// ---------------------------------------------------------------------------
// Raw API schema (GET /api/v2/doc/doc?mode=ArtList&format=json).
//
// ArtList returns `{ articles: [...] }`, or `{}` when nothing matches. Records
// carry a stable set of fields but we stay lenient (nullish + passthrough) so a
// new field or an occasional missing one never breaks a screen.
// ---------------------------------------------------------------------------

export const articleItemSchema = z
  .object({
    url: z.string(),
    url_mobile: z.string().nullish(),
    title: z.string().nullish(),
    seendate: z.string().nullish(),
    socialimage: z.string().nullish(),
    domain: z.string().nullish(),
    language: z.string().nullish(),
    sourcecountry: z.string().nullish(),
  })
  .passthrough()
export type ArticleItem = z.infer<typeof articleItemSchema>

/** `{ articles: [...] }`; an empty match returns `{}`, hence the default. */
export const artListResponseSchema = z
  .object({
    articles: z.array(articleItemSchema).default([]),
  })
  .passthrough()
export type ArtListResponse = z.infer<typeof artListResponseSchema>

// ---------------------------------------------------------------------------
// Domain types (what the client returns).
// ---------------------------------------------------------------------------

/** One news article mentioning the queried entity — an adverse-media candidate. */
export interface Article {
  url: string
  mobileUrl: string | null
  title: string | null
  /** Publication domain, e.g. `reuters.com`. */
  domain: string | null
  /** GDELT's plain-English language name, e.g. `English`. */
  language: string | null
  /** GDELT's plain-English source country, e.g. `United Kingdom`. */
  sourceCountry: string | null
  /** When GDELT first saw the article, ISO 8601 (`2026-06-01T12:00:00Z`) or null. */
  seenDate: string | null
  /** Lead/social image URL, if any. */
  imageUrl: string | null
}

/** Combined media coverage for one entity — adverse-media candidates for the brief. */
export interface EntityMediaCoverage {
  /** The GDELT query string that was actually issued. */
  query: string
  articles: Article[]
}

// ---------------------------------------------------------------------------
// Search options.
// ---------------------------------------------------------------------------

/** Ordering of returned articles. */
export type ArticleSort =
  | "date" // newest first (DateDesc)
  | "dateAsc" // oldest first (DateAsc)
  | "tone" // most positive first (ToneDesc)
  | "toneAsc" // most negative first (ToneAsc) — surfaces the harshest coverage
  | "relevance" // GDELT's hybrid relevance ranking (HybridRel)

/** Low-level article search. `query` is a raw GDELT DOC query expression. */
export interface ArticleSearchOptions {
  /** Raw GDELT query (phrases, `tone<-5`, `domain:`, `theme:`, `OR`, …). */
  query: string
  /** GDELT timespan grammar, e.g. `3m`, `1w`, `24h`. Ignored if dates are set. */
  timespan?: string
  /** Explicit window start (`Date` or `YYYYMMDDHHMMSS`). Overrides `timespan`. */
  startDate?: string | Date
  /** Explicit window end (`Date` or `YYYYMMDDHHMMSS`). */
  endDate?: string | Date
  /** 1–250. Defaults to {@link DEFAULT_MAX_RECORDS}. */
  maxRecords?: number
  /** Result ordering. Defaults to `date`. */
  sort?: ArticleSort
}

/** Convenience screen of one entity by name. */
export interface ScreenEntityOptions {
  timespan?: string
  startDate?: string | Date
  endDate?: string | Date
  maxRecords?: number
  /** Result ordering. Defaults to `toneAsc` (most adverse coverage first). */
  sort?: ArticleSort
  /** Only return coverage with average tone below this value (negative = adverse). */
  maxTone?: number
  /** Restrict to a GDELT source language, e.g. `english`. */
  sourceLang?: string
  /** Restrict to a GDELT source country, e.g. `unitedkingdom`. */
  sourceCountry?: string
}
