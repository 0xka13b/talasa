import type { CheerioAPI } from "cheerio"
import { companyResultSchema } from "../types"
import type { CompanyResult } from "../types"
import { cleanText, parseHtml } from "./html"

/**
 * Parse a company search results list (`form[name=formComp]`). Equasis renders a
 * desktop row (a `<th scope="row">` id cell + name + address) and a duplicate
 * mobile row; we key off the `th[scope="row"]` to take the desktop row only.
 */
export function extractCompanyResults(html: string): CompanyResult[] {
  const $ = parseHtml(html)
  const results: CompanyResult[] = []
  const seen = new Set<string>()

  $('form[name="formComp"] table tbody tr').each((_, tr) => {
    const idCell = $(tr).find('th[scope="row"]')
    if (idCell.length === 0) {
      return
    }
    const id = cleanText(idCell.text())
    if (id === "" || seen.has(id)) {
      return
    }
    const cells = $(tr).find("td")
    const entry = {
      id,
      name: cleanText(cells.eq(0).text()),
      address: cleanText(cells.eq(1).text()) || null,
    }
    const parsed = companyResultSchema.safeParse(entry)
    if (parsed.success) {
      seen.add(id)
      results.push(parsed.data)
    }
  })

  return results
}
