import type { Clients } from "../../clients"
import type { ManagementCompany } from "./types"

type EnrichClients = Pick<Clients, "gleif">

export interface EnrichedParent {
  lei: string
  legalName: string
  jurisdiction: string | null
  nodeId: string
}

export interface EnrichedCompany {
  key: string
  lei: string
  legalName: string
  jurisdiction: string | null
  registrationStatus: string
  entityStatus: string
  address: string | null
  directParent: EnrichedParent | null
  ultimateParent: EnrichedParent | null
}

export interface EnrichResult {
  companies: EnrichedCompany[]
}

const companyKey = (c: ManagementCompany) => c.companyImo ?? c.name

function fmtAddress(a: { lines: string[]; city: string | null; country: string | null } | null): string | null {
  if (!a) return null
  const parts = [...a.lines, a.city, a.country].filter((p): p is string => Boolean(p))
  return parts.length ? parts.join(", ") : null
}

type ParentLink = { lei: string; legalName: string; jurisdiction: string | null }

function toParent(p: ParentLink | null): EnrichedParent | null {
  if (!p) return null
  return { lei: p.lei, legalName: p.legalName, jurisdiction: p.jurisdiction, nodeId: `company:parent:${p.lei}` }
}

/**
 * Resolve each unique management company against GLEIF (exact matches only) to
 * legal info + direct/ultimate parent. Best-effort: per-company errors are
 * swallowed; a total GLEIF outage (no successes and at least one error) rethrows
 * so the orchestrator marks the stage failed.
 */
export async function enrichCompanies(companies: ManagementCompany[], c: EnrichClients): Promise<EnrichResult> {
  const seen = new Set<string>()
  const unique = companies.filter((co) => {
    const k = companyKey(co)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  const out: EnrichedCompany[] = []
  let lastError: unknown = null
  let errorCount = 0

  for (const co of unique) {
    try {
      const profile = await c.gleif.lookupCompany(co.name, { includeOwnership: true })
      if (!profile || profile.match.confidence !== "exact") continue
      const g = profile.company
      out.push({
        key: companyKey(co),
        lei: g.lei,
        legalName: g.legalName,
        jurisdiction: g.jurisdiction,
        registrationStatus: g.registrationStatus,
        entityStatus: g.entityStatus,
        address: fmtAddress(g.address),
        directParent: toParent(profile.directParent),
        ultimateParent: toParent(profile.ultimateParent),
      })
    } catch (err) {
      lastError = err
      errorCount += 1
    }
  }

  // Wholly unreachable: nothing succeeded and at least one call errored.
  if (out.length === 0 && errorCount > 0) {
    throw lastError
  }

  return { companies: out }
}
