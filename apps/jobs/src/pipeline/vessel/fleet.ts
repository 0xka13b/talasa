import type { Clients } from "../../clients"
import type { FleetCompany, FleetResult, ManagementCompany, SisterVessel, VesselCaps } from "./types"

/**
 * Reverse-expand each management company's fleet into sister vessels.
 *
 * Every sister discovered from a company's fleet listing is collected (so the
 * sanctions stage can screen them all by IMO). The expensive full Equasis ship
 * page is fetched only up to the caps; sisters beyond the caps keep their
 * listing-derived fields and the result is flagged `truncated` with a note.
 * The subject IMO is never counted as its own sister. A company whose fleet
 * fetch fails is skipped (best-effort) without failing the stage.
 */
export async function expandFleet(
  subjectImo: string,
  companies: ManagementCompany[],
  c: Pick<Clients, "equasis">,
  caps: VesselCaps,
): Promise<FleetResult> {
  const seen = new Set<string>([subjectImo])
  const fleetCompanies: FleetCompany[] = []
  const sisters: SisterVessel[] = []
  let pagesFetched = 0
  let truncated = false

  for (const company of companies) {
    if (!company.companyImo) continue
    let listing
    try {
      listing = await c.equasis.getCompanyFleet(company.companyImo)
    } catch {
      continue
    }
    const fresh = listing.vessels.filter((v) => !seen.has(v.imo))
    let sampledCount = 0
    const companySisters: SisterVessel[] = []

    for (const ref of fresh) {
      seen.add(ref.imo)
      let sister: SisterVessel = { imo: ref.imo, name: ref.name, flag: ref.flag, type: ref.type }

      const underCompanyCap = sampledCount < caps.maxSistersPerCompany
      const underGlobalCap = pagesFetched < caps.maxSisterPages
      if (underCompanyCap && underGlobalCap) {
        try {
          const ship = await c.equasis.getShipByImo(ref.imo)
          pagesFetched++
          sampledCount++
          sister = {
            imo: ref.imo,
            name: ship.particulars.name ?? ref.name,
            flag: ship.particulars.flag ?? ref.flag,
            type: ship.particulars.shipType ?? ref.type,
          }
        } catch {
          // keep the listing-derived sister
        }
      } else {
        truncated = true
      }

      companySisters.push(sister)
      sisters.push(sister)
    }

    fleetCompanies.push({
      companyImo: company.companyImo,
      name: company.name,
      role: company.role,
      vesselCount: listing.vessels.length,
      sampledCount,
      sisters: companySisters,
    })
  }

  const note = truncated
    ? `Full ship pages fetched for ${pagesFetched} sister vessels (caps: ${caps.maxSistersPerCompany}/company, ${caps.maxSisterPages} total). Remaining sisters were listed from company pages and screened by IMO, but not detailed.`
    : null

  return { companies: fleetCompanies, sisters, truncated, note }
}
