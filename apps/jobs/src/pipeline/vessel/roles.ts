import type { ManagementCompany } from "./types"

// Canonical role labels shown to the user, highest-priority first. Equasis lists
// the SAME company once per role (e.g. an ISM Manager row AND a "Ship manager/
// Commercial manager" row), so we canonicalise + merge rather than show dupes.
const ROLE_PRIORITY = ["Registered owner", "ISM Manager", "Commercial Manager", "Manager"] as const

/** Map a raw Equasis role string to a clean, consistent label. */
export function canonicalRole(raw: string): string {
  const r = raw.toLowerCase()
  if (r.includes("registered owner")) return "Registered owner"
  if (r.includes("ism")) return "ISM Manager"
  if (r.includes("commercial")) return "Commercial Manager"
  return "Manager"
}

function rolePriority(role: string): number {
  const i = (ROLE_PRIORITY as readonly string[]).indexOf(role)
  return i === -1 ? ROLE_PRIORITY.length : i
}

/** Distinct roles, highest-priority first. */
export function sortRoles(roles: string[]): string[] {
  return [...new Set(roles)].sort((a, b) => rolePriority(a) - rolePriority(b))
}

type RawCompany = { companyImo: string | null; role: string; name: string; address: string | null }

/**
 * Collapse the raw Equasis management rows — which repeat the same legal entity
 * once per role — into one {@link ManagementCompany} per company, carrying every
 * distinct (canonicalised) role. Keyed by IMO when present, else lower-cased
 * name. `role` keeps the highest-priority role for back-compat; `roles` has all.
 */
export function dedupeCompanies(rows: RawCompany[]): ManagementCompany[] {
  const byKey = new Map<string, ManagementCompany>()
  for (const row of rows) {
    const key = row.companyImo ?? row.name.toLowerCase()
    const role = canonicalRole(row.role)
    const existing = byKey.get(key)
    if (existing) {
      existing.roles = sortRoles([...existing.roles, role])
      existing.role = existing.roles[0]!
      existing.address ??= row.address
    } else {
      byKey.set(key, { companyImo: row.companyImo, name: row.name, address: row.address, role, roles: [role] })
    }
  }
  return [...byKey.values()]
}
