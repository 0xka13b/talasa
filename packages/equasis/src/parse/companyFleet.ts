import type { CompanyFleet, FleetVesselRef } from "../types"
import { parseHtml, cleanText, stripFalseFlag } from "./html"

/**
 * Parse a company's FleetInfo page (POST /restricted/FleetInfo?fs=CompanyInfo).
 * Each vessel row's first cell reads `( <a ...>IMO</a> ) NAME`; the subsequent
 * cells are: gross tonnage, ship's type, year of build, current flag, class…
 * We key on the `( 7-digit )` pattern in the first cell to select vessel rows
 * (header / spacer rows are skipped) and read type from cell[2], flag from cell[4].
 *
 * The company display name is best-effort (the pipeline labels companies from the
 * management block, not from this listing), so an empty string is acceptable.
 */
export function extractCompanyFleet(html: string, requestedCompanyImo: string): CompanyFleet {
  const $ = parseHtml(html)
  const vessels: FleetVesselRef[] = []
  const seen = new Set<string>()

  $("tr").each((_i, tr) => {
    const cells = $(tr).find("td")
    if (cells.length < 3) return
    const first = cleanText($(cells[0]).text())
    const imoMatch = first.match(/\b(\d{7})\b/)
    if (!imoMatch) return
    const imo = imoMatch[1]!
    if (imo === requestedCompanyImo || seen.has(imo)) return
    seen.add(imo)
    // Name = first cell minus the leading "( IMO )".
    const name = first.replace(/^\(?\s*\d{7}\s*\)?/, "").trim() || null
    const type = cleanText($(cells[2]).text()) || null
    const flag = cells.length > 4 ? stripFalseFlag($(cells[4]).text()) : null
    vessels.push({ imo, name, flag, type })
  })

  const name = cleanText($("h1, h2, .title").first().text()) || ""
  return { companyImo: requestedCompanyImo, name, vessels }
}
