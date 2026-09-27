import type { UndisclosedOwnershipFlag, VesselIdentity } from "@talasa/shared"
import type { GeographyEntry } from "@talasa/equasis"

export interface VesselInput { imo: string }

export interface ManagementCompany {
  companyImo: string | null
  /** Primary (highest-priority) role — kept for back-compat + simple labels. */
  role: string
  /** All distinct roles this legal entity holds toward the subject (deduped, e.g.
   * ["ISM Manager", "Commercial Manager"] when Equasis lists it under both). */
  roles: string[]
  name: string
  address: string | null
}

export interface IdentifyResult {
  identity: VesselIdentity
  companies: ManagementCompany[]
  /** Geographic sightings from the same ShipInfo page (no extra Equasis call). */
  geography: GeographyEntry[]
  /** Undisclosed/unknown ownership placeholders found on the raw management rows. */
  ownershipFlags: UndisclosedOwnershipFlag[]
}

export interface SisterVessel {
  imo: string
  name: string | null
  flag: string | null
  type: string | null
}

export interface FleetCompany {
  companyImo: string | null
  name: string
  role: string
  vesselCount: number
  sampledCount: number
  sisters: SisterVessel[]
}

export interface FleetResult {
  companies: FleetCompany[]
  sisters: SisterVessel[]
  truncated: boolean
  note: string | null
}

export interface VesselCaps {
  maxSistersPerCompany: number
  maxSisterPages: number
}
