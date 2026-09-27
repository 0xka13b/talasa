import type { CheerioAPI } from "cheerio"
import { ParseError } from "../errors"
import { historyEntrySchema, shipHistorySchema } from "../types"
import type { HistoryEntry, ShipHistory } from "../types"
import { cleanText, parseHtml, stripFalseFlag } from "./html"

/**
 * Parse the ship-history page into a {@link ShipHistory}.
 *
 * Equasis groups the history into four `table.tableLS` tables, each with a
 * distinct header:
 *  - "Name of ship"          → one row per former/current name      (kind "name")
 *  - "Flag"                  → one row per flag state               (kind "flag")
 *  - "Classification society"→ one row per survey                   (kind "class")
 *  - "Company"               → one row per company role; the row's
 *                              own "Role" column becomes the kind   (e.g. "Registered owner")
 *
 * Each row carries a single effective-from date ("since DD/MM/YYYY", or a bare
 * survey date for the classification table). Equasis never records an end date,
 * so {@link HistoryEntry.to} is always null. We key tables off their header text
 * rather than position so an absent table just yields no rows of that kind.
 */
export function extractShipHistory(html: string, requestedImo: string): ShipHistory {
  const $ = parseHtml(html)
  const imo = cleanText($('input[name="P_IMO"]').attr("value")) || cleanText(requestedImo)

  const entries: HistoryEntry[] = []
  $("table").each((_, table) => {
    const header = cleanText($(table).find("thead th, thead td").text()).toLowerCase()
    const kind = tableKind(header)
    if (kind === null) {
      return
    }
    const companyTable = kind === "company"
    $(table)
      .find("tbody tr")
      .each((__, tr) => {
        const cells = $(tr).find("td")
        if (cells.length === 0) {
          return
        }
        const entry = companyTable ? companyEntry(cells) : simpleEntry(cells, kind)
        const parsed = historyEntrySchema.safeParse(entry)
        if (parsed.success && (parsed.data.value !== null || parsed.data.from !== null)) {
          entries.push(parsed.data)
        }
      })
  })

  const result: ShipHistory = { imo, entries }
  const validated = shipHistorySchema.safeParse(result)
  if (!validated.success) {
    throw new ParseError(`ship history: ${validated.error.message}`)
  }
  return validated.data
}

/** Map a table's header text to the kind it carries, or null if not a history table. */
function tableKind(header: string): string | null {
  if (header.includes("name of ship")) {
    return "name"
  }
  if (header.includes("flag")) {
    return "flag"
  }
  if (header.includes("classification society")) {
    return "class"
  }
  if (header.includes("company") && header.includes("role")) {
    return "company"
  }
  return null
}

/** Name/flag/class row: [value, date, source]. */
function simpleEntry(cells: ReturnType<CheerioAPI>, kind: string): HistoryEntry {
  // Flag rows can carry the same stray "false"/"true" token as ship particulars.
  const value = kind === "flag" ? stripFalseFlag(cells.eq(0).text()) : cleanText(cells.eq(0).text()) || null
  return {
    kind,
    value,
    from: parseDate(cells.eq(1).text()),
    to: null,
  }
}

/** Company row: [company, role, date, source] — the role becomes the kind. */
function companyEntry(cells: ReturnType<CheerioAPI>): HistoryEntry {
  return {
    kind: cleanText(cells.eq(1).text()) || "company",
    value: cleanText(cells.eq(0).text()) || null,
    from: parseDate(cells.eq(2).text()),
    to: null,
  }
}

/** Pull a DD/MM/YYYY date out of a cell, dropping the "since " prefix Equasis adds. */
function parseDate(value: string | undefined | null): string | null {
  const match = /(\d{2}\/\d{2}\/\d{4})/.exec(cleanText(value))
  return match && match[1] ? match[1] : null
}
