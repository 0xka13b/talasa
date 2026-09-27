import type { CheerioAPI } from "cheerio"
import { geographyEntrySchema } from "../types"
import type { GeographyEntry } from "../types"
import { cleanText } from "./html"

/**
 * Extract the "Geographical Information" table from the ShipInfo page.
 *
 * Equasis renders recent sightings in a `table.tableLS` with three columns:
 *  - "Date of record"              → a coarse month/year (e.g. "June 2026")
 *  - "Area where the ship was seen"→ one or more comma-separated zones
 *                                    (e.g. "East Asia, South East Asia")
 *  - "Source"                      → the tracking source (MarineTraffic,
 *                                    VesselTracker, AXS Marine, …)
 *
 * We key off the header text rather than table position because the same page
 * carries another `tableLS` (the management/ownership grid), and an absent
 * geography section simply yields no rows. Ordering follows the page (most
 * recent first).
 */
export function extractGeography($: CheerioAPI): GeographyEntry[] {
  const table = geographyTable($)
  if (table === null) {
    return []
  }

  const entries: GeographyEntry[] = []
  table.find("tbody tr").each((_, tr) => {
    const cells = $(tr).find("td")
    if (cells.length < 3) {
      return
    }
    const entry: GeographyEntry = {
      date: cleanText(cells.eq(0).text()) || null,
      area: cleanText(cells.eq(1).text()) || null,
      source: cleanText(cells.eq(2).text()) || null,
    }
    if (entry.date === null && entry.area === null && entry.source === null) {
      return
    }
    const parsed = geographyEntrySchema.safeParse(entry)
    if (parsed.success) {
      entries.push(parsed.data)
    }
  })
  return entries
}

/**
 * Locate the geography table by its "Date of record" + "Area where the ship was
 * seen" header, distinguishing it from the management `tableLS` on the same page.
 */
function geographyTable($: CheerioAPI): ReturnType<CheerioAPI> | null {
  let match: ReturnType<CheerioAPI> | null = null
  $("table").each((_, table) => {
    if (match) {
      return
    }
    const headers = cleanText($(table).find("thead th, thead td").text()).toLowerCase()
    if (headers.includes("date of record") && headers.includes("area where the ship was seen")) {
      match = $(table)
    }
  })
  return match
}
