import type { VesselIdentity } from "@talasa/shared"
import { isHighRiskFlag } from "@talasa/shared"
import type { Clients } from "../../clients"
import type { IdentifyResult, VesselInput } from "./types"
import { dedupeCompanies } from "./roles"
import { detectUndisclosedOwnership } from "./ownership"

/** Roles whose companies seed sanctions screening + sister-fleet expansion. */
const MANAGEMENT_ROLE = /(registered owner|ism manager|commercial manager|manager)/i

export async function identifyVessel(input: VesselInput, c: Pick<Clients, "equasis">): Promise<IdentifyResult> {
  const ship = await c.equasis.getShipByImo(input.imo)
  const p = ship.particulars
  const o = ship.overview

  const identity: VesselIdentity = {
    imo: p.imo,
    name: p.name ?? null,
    flag: p.flag,
    type: p.shipType,
    grossTonnage: p.grossTonnage,
    deadweight: p.deadweight,
    yearBuilt: p.yearOfBuild,
    classSociety: o.classedByIacs ? "IACS member society" : null,
    mmsi: p.mmsi,
    callSign: p.callSign,
    status: p.status,
    riskyFlag: isHighRiskFlag(p.flag),
    detentionRate: o.detentionRate,
    parisMou: o.parisMou,
    tokyoMou: o.tokyoMou,
  }

  // Equasis lists a company once per role — dedupe to one entity carrying all
  // its roles (so ISM + Commercial manager is one row, not two "Manager" rows).
  const companies = dedupeCompanies(
    ship.management
      .filter((m) => m.companyImo && MANAGEMENT_ROLE.test(m.role))
      .map((m) => ({ companyImo: m.companyImo, role: m.role, name: m.name, address: m.address })),
  )

  // Detect undisclosed/unknown ownership placeholders from the RAW rows — these
  // carry no company IMO, so they were dropped from `companies` above.
  const ownershipFlags = detectUndisclosedOwnership(ship.management)

  return { identity, companies, geography: ship.geography ?? [], ownershipFlags }
}
