import type { CheerioAPI } from "cheerio"
import { ParseError } from "../errors"
import { inspectionSchema, shipInspectionsSchema } from "../types"
import type { Inspection, ShipInspections } from "../types"
import { cleanText, parseHtml, toNumber } from "./html"

/**
 * Parse the ship-inspection (PSC) page into a {@link ShipInspections}.
 *
 * The inspection table (`table.tableLSDD`) lists one row per inspection report.
 * A primary row carries the full set of columns — Authority (country), Port,
 * Date of report, Detention (Y/N), PSC Organisation, Type, Duration, Number of
 * deficiencies, Details. When a single physical inspection was reported by a
 * second MOU, Equasis renders a `rowspan` continuation row that omits the first
 * four columns (5 cells instead of 9); those are not standalone events, so we
 * key off the full-width rows only.
 */
export function extractShipInspections(html: string, requestedImo: string): ShipInspections {
  const $ = parseHtml(html)
  const imo = cleanText($('input[name="P_IMO"]').attr("value")) || cleanText(requestedImo)

  const inspections: Inspection[] = []
  inspectionTable($)
    .find("tbody tr")
    .each((_, tr) => {
      const cells = $(tr).find("td")
      // Only full-width primary rows carry country/port/date/detention.
      if (cells.length < 9) {
        return
      }
      const detention = cleanText(cells.eq(3).text())
      const inspection: Inspection = {
        authority: cleanText(cells.eq(0).text()) || null,
        port: cleanText(cells.eq(1).text()) || null,
        date: cleanText(cells.eq(2).text()) || null,
        detained: /^y(es)?$/i.test(detention),
        deficiencies: toNumber(cells.eq(7).text()),
      }
      const parsed = inspectionSchema.safeParse(inspection)
      if (parsed.success) {
        inspections.push(parsed.data)
      }
    })

  const result: ShipInspections = { imo, inspections }
  const validated = shipInspectionsSchema.safeParse(result)
  if (!validated.success) {
    throw new ParseError(`ship inspections: ${validated.error.message}`)
  }
  return validated.data
}

/**
 * Locate the PSC inspection table. It is the table whose header row carries the
 * "Date of report" + "Detention" columns, distinguishing it from the secondary
 * "Other inspections" table on the same page.
 */
function inspectionTable($: CheerioAPI): ReturnType<CheerioAPI> {
  let match: ReturnType<CheerioAPI> | null = null
  $("table").each((_, table) => {
    if (match) {
      return
    }
    const headers = cleanText($(table).find("thead th, thead td").text()).toLowerCase()
    if (headers.includes("date of report") && headers.includes("detention")) {
      match = $(table)
    }
  })
  return match ?? $("table.tableLSDD").first()
}
