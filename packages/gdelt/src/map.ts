import type { Article, ArticleItem } from "./types"

/** Map a raw DOC article record to a domain {@link Article}. */
export function toArticle(item: ArticleItem): Article {
  return {
    url: item.url,
    mobileUrl: emptyToNull(item.url_mobile),
    title: emptyToNull(item.title),
    domain: emptyToNull(item.domain),
    language: emptyToNull(item.language),
    sourceCountry: emptyToNull(item.sourcecountry),
    seenDate: parseSeenDate(item.seendate),
    imageUrl: emptyToNull(item.socialimage),
  }
}

/** GDELT often uses `""` rather than omitting a field; treat both as absent. */
function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/**
 * GDELT stamps are `YYYYMMDDTHHMMSSZ` (e.g. `20260601T120000Z`). Convert to
 * ISO 8601; return null if the value is missing or not in that shape.
 */
function parseSeenDate(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/.exec(value.trim())
  if (!match) {
    return null
  }
  const [, y, mo, d, h, mi, s] = match
  return `${y}-${mo}-${d}T${h}:${mi}:${s}Z`
}
