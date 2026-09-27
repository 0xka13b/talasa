import type { CheerioAPI } from "cheerio"
import { NotFoundError, ParseError } from "../errors"
import { managementEntrySchema, shipInfoSchema } from "../types"
import type { ManagementEntry, ShipInfo, ShipOverview } from "../types"
import { extractGeography } from "./geography"
import { cleanText, parseHtml, stripFalseFlag, stripParens, toNumber } from "./html"

/** Particulars rows we lift out of the label/value grid, by normalized label. */
const PARTICULAR_LABELS = new Set([
  "flag",
  "call sign",
  "mmsi",
  "gross tonnage",
  "dwt",
  "type of ship",
  "year of build",
  "status",
  "last update of ship particulars",
])

/** Parse the ship detail page (returned by a ship-by-IMO search) into {@link ShipInfo}. */
export function extractShipInfo(html: string, requestedImo: string): ShipInfo {
  const $ = parseHtml(html)

  const imo = cleanText($('input[name="P_IMO"]').attr("value")) || cleanText(requestedImo)
  const name = cleanText($("h4.color-gris-bleu-copyright b").first().text())
  if (imo === "" || name === "") {
    throw new NotFoundError(`ship IMO ${requestedImo}`)
  }

  const labels = buildParticularsMap($)
  const result: ShipInfo = {
    particulars: {
      imo,
      name,
      flag: stripFalseFlag(stripParens(labels.get("flag"))),
      callSign: labels.get("call sign") ?? null,
      mmsi: labels.get("mmsi") ?? null,
      grossTonnage: toNumber(labels.get("gross tonnage")),
      deadweight: toNumber(labels.get("dwt")),
      shipType: labels.get("type of ship") ?? null,
      yearOfBuild: labels.get("year of build") ?? null,
      status: labels.get("status") ?? null,
      lastUpdate: labels.get("last update of ship particulars") ?? null,
    },
    overview: extractOverview($),
    management: extractManagement($),
    geography: extractGeography($),
  }

  const parsed = shipInfoSchema.safeParse(result)
  if (!parsed.success) {
    throw new ParseError(`ship info: ${parsed.error.message}`)
  }
  return parsed.data
}

/**
 * Build a label -> value map from the `<b>label</b>` / value-column grid. The
 * value is the first *non-empty* sibling column: most rows put it immediately
 * after the label, but the Flag row has an icon column (and a spacer) before the
 * country name.
 */
function buildParticularsMap($: CheerioAPI): Map<string, string> {
  const map = new Map<string, string>()
  $("b").each((_, el) => {
    const label = cleanText($(el).text()).toLowerCase()
    if (!PARTICULAR_LABELS.has(label) || map.has(label)) {
      return
    }
    let value = ""
    $(el)
      .closest('[class*="col-"]')
      .nextAll('[class*="col-"]')
      .each((_, col) => {
        if (value === "") {
          value = cleanText($(col).text())
        }
      })
    if (value !== "") {
      map.set(label, value)
    }
  })
  return map
}

/** Pull the compliance summary from the ship page header. */
function extractOverview($: CheerioAPI): ShipOverview {
  const bodyText = cleanText($("body").text())
  const detention = /([0-9]+(?:\.[0-9]+)?%)\s*Of inspections having led to a detention/i.exec(bodyText)
  return {
    classedByIacs: /classed by .*IACS member/i.test(bodyText),
    detentionRate: detention?.[1] ?? null,
    parisMou: extractMouColor($, "Paris MOU"),
    tokyoMou: extractMouColor($, "Tokyo MOU"),
    usCoastGuard: extractUscg($),
  }
}

/** Each MOU badge holds two `<p>`: the MOU name and its colour band. */
function extractMouColor($: CheerioAPI, mou: string): string | null {
  let color: string | null = null
  $("div.badge").each((_, el) => {
    const paragraphs = $(el).find("p")
    if (cleanText(paragraphs.first().text()) !== mou) {
      return
    }
    color = cleanText(paragraphs.last().text()) || null
  })
  return color
}

function extractUscg($: CheerioAPI): string | null {
  let value: string | null = null
  $("p").each((_, el) => {
    const text = cleanText($(el).text())
    if (/^USCG:/i.test(text)) {
      value = text.replace(/^USCG:\s*/i, "") || null
    }
  })
  return value
}

/** Parse the management/ownership table (`form[name=formShipToComp]`). */
function extractManagement($: CheerioAPI): ManagementEntry[] {
  const entries: ManagementEntry[] = []
  const seen = new Set<string>()
  $('form[name="formShipToComp"] table tbody tr').each((_, tr) => {
    const cells = $(tr).find("td")
    if (cells.length < 5) {
      return
    }
    const entry: ManagementEntry = {
      companyImo: cleanText(cells.eq(0).text()) || null,
      role: cleanText(cells.eq(1).text()),
      name: cleanText(cells.eq(2).text()),
      address: cleanText(cells.eq(3).text()) || null,
      dateOfEffect: cleanText(cells.eq(4).text()) || null,
    }
    if (entry.role === "" && entry.name === "") {
      return
    }
    const key = `${entry.companyImo ?? ""}|${entry.role}|${entry.name}`
    if (seen.has(key)) {
      return
    }
    const parsed = managementEntrySchema.safeParse(entry)
    if (parsed.success) {
      seen.add(key)
      entries.push(parsed.data)
    }
  })
  return entries
}
