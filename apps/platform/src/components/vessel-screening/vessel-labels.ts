/**
 * Human-readable labels for the machine codes that show up in a vessel brief —
 * OpenSanctions dataset ids, signal kinds, verdict drivers, match fields.
 * Raw codes like "ca_dfatd_sema_sanctions" are unreadable in the UI.
 */

// Curated names for the OpenSanctions dataset ids we commonly surface.
const SANCTIONS_LIST_LABELS: Record<string, string> = {
  us_ofac_sdn: "OFAC SDN (US)",
  us_ofac_cons: "OFAC Consolidated (US)",
  us_bis_denied: "BIS Denied Persons (US)",
  us_trade_csl: "US Consolidated Screening List",
  eu_fsf: "EU Financial Sanctions",
  eu_sanctions_map: "EU Sanctions Map",
  gb_hmt_sanctions: "UK HMT Sanctions",
  ca_dfatd_sema_sanctions: "Canada SEMA Sanctions",
  un_sc_sanctions: "UN Security Council",
  au_dfat_sanctions: "Australia DFAT Sanctions",
  ch_seco_sanctions: "Switzerland SECO Sanctions",
  fr_tresor_gels_avoir: "France Treasury Asset Freezes",
}

// Tokens kept fully uppercased when humanizing (country codes + agency acronyms).
const ACRONYMS = new Set([
  "us",
  "eu",
  "un",
  "uk",
  "gb",
  "ca",
  "au",
  "ch",
  "fr",
  "ru",
  "ir",
  "kp",
  "imo",
  "mmsi",
  "ofac",
  "sdn",
  "hmt",
  "sema",
  "fsf",
  "bis",
  "dfat",
  "seco",
  "sc",
  "dfatd",
  "csl",
  "mou",
  "psc",
  "gt",
  "dwt",
  "sts",
  "ais",
  "id",
])

function capitalize(word: string): string {
  return word.length === 0 ? word : word[0].toUpperCase() + word.slice(1)
}

/**
 * Turn a snake/kebab/dot/camel token into a readable phrase. The first word is
 * capitalized, the rest lower-cased, and known acronyms stay uppercase.
 * "sister_sanction" → "Sister sanction"; "imo" → "IMO".
 */
export function humanizeToken(raw: string): string {
  const parts = raw
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[_\-.\s]+/)
    .filter(Boolean)
  if (parts.length === 0) return raw
  return parts
    .map((part, i) => {
      const lower = part.toLowerCase()
      if (ACRONYMS.has(lower)) return lower.toUpperCase()
      return i === 0 ? capitalize(lower) : lower
    })
    .join(" ")
}

/** Readable name for an OpenSanctions dataset id, with a humanized fallback. */
export function formatSanctionsList(code: string): string {
  return SANCTIONS_LIST_LABELS[code] ?? humanizeToken(code)
}

/**
 * Readable names for every source list a match appears on. Falls back to the
 * single `list` field for briefs written before we persisted the full set.
 */
export function formatSanctionsLists(
  datasets: string[] | undefined,
  fallback: string
): string {
  const codes = datasets && datasets.length > 0 ? datasets : [fallback]
  return codes.map(formatSanctionsList).join(", ")
}

// How a match relates to sanctions — the distinction between a party that is
// itself designated and one merely linked to a sanctioned entity.
const SANCTION_CATEGORY_LABELS: Record<string, string> = {
  sanctioned: "Directly sanctioned",
  sanction_linked: "Sanction-linked",
  pep: "Politically exposed",
  poi: "Entity of interest",
  other: "Flagged",
}

/** Readable label for a match category, or "" when absent (older briefs). */
export function formatSanctionCategory(category: string | undefined): string {
  if (!category) return ""
  return SANCTION_CATEGORY_LABELS[category] ?? humanizeToken(category)
}

/**
 * A directly-sanctioned match is the severe (red) case; a linked / PEP / POI
 * match is a softer amber note — it does not mean the party is itself listed.
 */
export function isDirectSanction(category: string | undefined): boolean {
  return category === "sanctioned"
}

/**
 * Verdict drivers are dotted category paths ("fleet.sister_sanctioned"). Render
 * as "Fleet — Sister sanctioned" so the category reads clearly.
 */
export function formatDriver(raw: string): string {
  const [head, ...rest] = raw.split(".")
  if (!head || rest.length === 0) return humanizeToken(raw)
  return `${humanizeToken(head)} — ${humanizeToken(rest.join("."))}`
}

// Ship-history change kinds. Company-role kinds ("Registered owner", "ISM
// Manager", …) are already human-readable and pass straight through.
const HISTORY_KIND_LABELS: Record<string, string> = {
  name: "Name",
  flag: "Flag",
  class: "Classification",
}

/** Label a ship-history change kind for the report timeline. */
export function formatHistoryKind(kind: string): string {
  return HISTORY_KIND_LABELS[kind] ?? kind
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

/**
 * Normalise the mix of date shapes in a brief — ISO timestamps
 * ("2025-06-17T00:00:00Z"), Equasis DD/MM/YYYY ("17/06/2025"), and coarse
 * month strings ("June 2026") — to one "17 Jun, 2025" style. Anything that
 * isn't a full day (coarse month, free text) passes through unchanged so no
 * information is lost. Null/empty renders an em dash.
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const trimmed = value.trim()
  // ISO date / datetime — YYYY-MM-DD…
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed)
  if (m) {
    const mon = MONTHS[Number(m[2]) - 1]
    if (mon) return `${Number(m[3])} ${mon}, ${m[1]}`
  }
  // Equasis DD/MM/YYYY
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed)
  if (m) {
    const mon = MONTHS[Number(m[2]) - 1]
    if (mon) return `${Number(m[1])} ${mon}, ${m[3]}`
  }
  return trimmed
}

/**
 * Rewrite date-like substrings inside free narrative (recommendation, summary,
 * prediction) to the "17 Jul, 2025" style — the LLM tends to echo raw Equasis
 * "06/12/2024" or ISO "2024-12-06" dates mid-sentence. Non-date numbers are left
 * untouched. Equasis dates are DD/MM/YYYY, matching `formatDate`.
 */
export function formatDatesInText(text: string): string {
  return text
    .replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (full, d, mo, y) => {
      const mon = MONTHS[Number(mo) - 1]
      return mon ? `${Number(d)} ${mon}, ${y}` : full
    })
    .replace(
      /\b(\d{4})-(\d{2})-(\d{2})(?:T[\d:.]+Z?)?\b/g,
      (full, y, mo, d) => {
        const mon = MONTHS[Number(mo) - 1]
        return mon ? `${Number(d)} ${mon}, ${y}` : full
      }
    )
}

/** Sanctions screening status → readable label. */
export function formatSanctionsStatus(status: string): string {
  const map: Record<string, string> = {
    NO_MATCH: "No match",
    POSSIBLE: "Possible match",
    CONFIRMED: "Confirmed",
  }
  return map[status] ?? humanizeToken(status)
}

/**
 * Human labels for the raw camelCase keys that appear in a graph node's `data`
 * bag — vessel identity, ownership, fleet and company fields. Shown in the
 * graph's slide-in detail panel (shared by vessel screening + counterparty DD).
 * Anything not listed falls back to `humanizeToken`, so a new key still reads
 * cleanly ("companyImo" → "Company IMO") without a code change.
 */
const NODE_FIELD_LABELS: Record<string, string> = {
  // Vessel identity
  imo: "IMO",
  name: "Name",
  flag: "Flag",
  type: "Type",
  status: "Status",
  mmsi: "MMSI",
  callSign: "Call sign",
  grossTonnage: "Gross tonnage",
  deadweight: "Deadweight",
  yearBuilt: "Year built",
  classSociety: "Class society",
  riskyFlag: "High-risk flag",
  detentionRate: "Detention rate",
  parisMou: "Paris MoU",
  tokyoMou: "Tokyo MoU",
  registeredOwner: "Registered owner",
  manager: "Manager",
  // Company / ownership
  companyImo: "Company IMO",
  equasisId: "Registry ID",
  lei: "LEI",
  jurisdiction: "Jurisdiction",
  country: "Country",
  address: "Address",
  role: "Role",
  roles: "Roles",
  vesselCount: "Fleet size",
  fleetCount: "Fleet size",
  sharedVessels: "Shared vessels",
  affiliate: "Affiliate",
  kind: "Relationship",
}

/** Readable label for a graph-node data key ("companyImo" → "Company IMO"). */
export function formatNodeField(key: string): string {
  return NODE_FIELD_LABELS[key] ?? humanizeToken(key)
}

/**
 * Render a graph-node data value for display: Yes/No for booleans, comma-joined
 * lists, and grouped thousands for numbers ("13685" tonnage → "13,685").
 */
export function formatNodeValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (Array.isArray(value)) return value.map((v) => String(v)).join(", ")
  if (typeof value === "number") return value.toLocaleString("en-US")
  return String(value)
}
