import type { CompanyOwnership } from "@talasa/shared"
import type { GleifClient } from "@talasa/gleif"

type OwnershipClients = Pick<{ gleif: GleifClient }, "gleif">

/**
 * Resolve the subject's corporate ownership via GLEIF: match the legal name to
 * an LEI, then pull the direct and ultimate consolidating parents. This is the
 * legal-entity spine of the network — it de-anonymises who ultimately controls
 * the counterparty, complementing the operational (fleet-management) links.
 *
 * Returns null when the name can't be matched to an LEI record. Best-effort —
 * the caller treats a thrown error as a data gap, not a failure.
 */
export async function resolveOwnership(
  name: string,
  c: OwnershipClients,
): Promise<CompanyOwnership | null> {
  const profile = await c.gleif.lookupCompany(name, { includeOwnership: true })
  if (!profile) return null

  return {
    lei: profile.company.lei,
    legalName: profile.company.legalName,
    jurisdiction: profile.company.jurisdiction,
    registrationStatus: profile.company.registrationStatus,
    matchConfidence: profile.match.confidence,
    directParent: profile.directParent
      ? { lei: profile.directParent.lei, legalName: profile.directParent.legalName, jurisdiction: profile.directParent.jurisdiction }
      : null,
    ultimateParent: profile.ultimateParent
      ? { lei: profile.ultimateParent.lei, legalName: profile.ultimateParent.legalName, jurisdiction: profile.ultimateParent.jurisdiction }
      : null,
  }
}
