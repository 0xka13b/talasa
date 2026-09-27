import { load } from "cheerio"
import type { CheerioAPI } from "cheerio"

/** Load HTML into a cheerio document. */
export function parseHtml(html: string): CheerioAPI {
  return load(html)
}

/** Collapse whitespace (incl. &nbsp;) and trim — Equasis markup is heavily indented. */
export function cleanText(value: string | undefined | null): string {
  return (value ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim()
}

/** Parse a numeric value out of a label cell ("64807", "116 998"), or null. */
export function toNumber(value: string | undefined | null): number | null {
  const digits = cleanText(value).replace(/[^0-9.]/g, "")
  if (digits === "") {
    return null
  }
  const parsed = Number(digits)
  return Number.isFinite(parsed) ? parsed : null
}

/** Strip a single pair of surrounding parentheses, e.g. "(Liberia)" -> "Liberia". */
export function stripParens(value: string | undefined | null): string | null {
  const cleaned = cleanText(value)
  if (cleaned === "") {
    return null
  }
  return cleaned.replace(/^\(/, "").replace(/\)$/, "").trim() || null
}

/**
 * Strip a stray "false"/"true" token Equasis occasionally appends to (or, rarely,
 * prepends onto) a flag-country value — e.g. "Madagascar false" -> "Madagascar",
 * "Malta False" -> "Malta". The token comes from an adjacent boolean cell bleeding
 * into the country text; no real flag state contains a bare "false"/"true" word,
 * so removing it is safe. Returns null when nothing meaningful remains.
 */
export function stripFalseFlag(value: string | undefined | null): string | null {
  const cleaned = cleanText(value)
  if (cleaned === "") {
    return null
  }
  return cleaned
    .replace(/\s*\b(?:true|false)\b\s*$/i, "")
    .replace(/^\s*\b(?:true|false)\b\s*/i, "")
    .trim() || null
}
