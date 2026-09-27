import type {
  ResolvedEntity,
  FleetVessel,
  LinkedCompany,
  CompanyProfile,
  AffiliationGraph,
  Detention,
} from "@talasa/shared"
import type { EquasisClient } from "@talasa/equasis"
import { MAX_FLEET_SAMPLE, MAX_LINKED_EXPANDED, MAX_AFFILIATE_FLEET_SAMPLE } from "./types"

type NetworkClients = Pick<{ equasis: EquasisClient }, "equasis">

export interface NetworkResult {
  /** The subject company's own record (name/address/country + fleet size). */
  companyProfile: CompanyProfile
  fleet: FleetVessel[]
  /** Companies co-owning / co-managing the subject's vessels — the corporate network. */
  linkedCompanies: LinkedCompany[]
  /** Distinct owner / manager names across the fleet (kept for sanctions screening). */
  owners: string[]
  managers: string[]
  detentions: Detention[]
  /** Legacy flat affiliation graph — kept so the brief's `affiliations` field stays populated. */
  affiliations: AffiliationGraph
  /** True when the fleet was larger than the ship-page sample cap. */
  truncated: boolean
}

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim()

/**
 * Map the subject company's corporate/fleet network from Equasis.
 *
 * 1. Enumerate the fleet via `getCompanyFleet(equasisCompanyId)`.
 * 2. For a capped sample of those vessels, fetch the full ship page and read the
 *    management chain — every OTHER company on it (co-owner / co-manager) becomes
 *    a LINKED COMPANY sharing that vessel with the subject. This traversal is the
 *    "full network of relationships"; Equasis has no direct related-companies API.
 * 3. Best-effort per-vessel PSC inspections → detentions.
 *
 * Every per-vessel fetch is best-effort: a failure drops that vessel's detail
 * without failing the stage.
 */
export async function mapCompanyNetwork(
  resolved: ResolvedEntity,
  c: NetworkClients,
): Promise<NetworkResult> {
  // Ensure we have an Equasis company number to enumerate the fleet from. Resolve
  // normally pins it, but a transient Equasis hiccup at resolve time (or an
  // OpenSanctions-only match) can leave it null — in which case we search by name
  // HERE so a one-off resolve failure doesn't permanently blank the fleet. This
  // makes the network stage self-sufficient: search → company → fleet.
  const equasisId = resolved.equasisCompanyId ?? (await findCompanyId(resolved.canonicalName, c))
  if (!equasisId) {
    return emptyNetwork(resolved)
  }

  // 1. Fleet listing (cheap: imo/name/flag/type per vessel).
  const listing = await c.equasis.getCompanyFleet(equasisId)
  const listed = listing.vessels
  const sampleImos = listed.slice(0, MAX_FLEET_SAMPLE).map((v) => v.imo)

  // 2. Sample ship pages → owner/manager + linked companies + subject refinement.
  const linkedByKey = new Map<string, LinkedCompany>()
  const detailByImo = new Map<string, { registeredOwner: string | null; manager: string | null }>()
  let subjectName: string | null = null
  let subjectAddress: string | null = null

  const ships = await Promise.all(
    sampleImos.map((imo) =>
      c.equasis.getShipByImo(imo).then((s) => ({ imo, ship: s })).catch(() => null),
    ),
  )

  for (const entry of ships) {
    if (!entry) continue
    const { imo, ship } = entry
    detailByImo.set(imo, {
      registeredOwner: ship.management.find((m) => /registered owner/i.test(m.role))?.name ?? null,
      manager: ship.management.find((m) => /^(ism\s+)?manager$/i.test(m.role))?.name ?? null,
    })
    const subjectNorm = normalise(subjectName ?? resolved.canonicalName)
    for (const m of ship.management) {
      // The subject's own management entry — capture its canonical name/address.
      if (m.companyImo === equasisId) {
        subjectName ??= m.name
        subjectAddress ??= m.address
        continue
      }
      // Skip entries that are clearly the subject by name (missing companyImo).
      if (m.companyImo == null && normalise(m.name) === subjectNorm) continue
      // A different company on the subject's vessel → a linked company.
      const key = m.companyImo ?? `name:${normalise(m.name)}`
      const existing = linkedByKey.get(key)
      if (existing) {
        if (!existing.roles.includes(m.role)) existing.roles.push(m.role)
        if (!existing.sharedVesselImos.includes(imo)) existing.sharedVesselImos.push(imo)
        if (!existing.address && m.address) existing.address = m.address
      } else {
        linkedByKey.set(key, { companyImo: m.companyImo, name: m.name, roles: [m.role], sharedVesselImos: [imo], sanctioned: false, address: m.address ?? null, fleetCount: 0, fleet: [] })
      }
    }
  }

  // 3. Detentions from PSC inspections on the sampled vessels (best-effort).
  const detentions: Detention[] = []
  const inspections = await Promise.all(
    sampleImos.map((imo) =>
      c.equasis.getShipInspections(imo).then((r) => ({ imo, r })).catch(() => null),
    ),
  )
  for (const entry of inspections) {
    if (!entry) continue
    for (const insp of entry.r.inspections) {
      if (!insp.detained) continue
      const parts: string[] = []
      if (insp.port) parts.push(insp.port)
      if (insp.deficiencies != null) parts.push(`${insp.deficiencies} deficienc${insp.deficiencies === 1 ? "y" : "ies"}`)
      detentions.push({ imo: entry.imo, authority: insp.authority, date: insp.date, detail: parts.length ? parts.join(" · ") : null })
    }
  }

  // Build the fleet list: sampled vessels carry owner/manager, the rest are listing-only.
  const fleet: FleetVessel[] = listed.map((v) => {
    const detail = detailByImo.get(v.imo)
    return {
      imo: v.imo,
      name: v.name,
      flag: v.flag,
      type: v.type,
      registeredOwner: detail?.registeredOwner ?? null,
      manager: detail?.manager ?? null,
    }
  })

  const owners = [...new Set(fleet.map((v) => v.registeredOwner).filter((x): x is string => !!x))]
  const managers = [...new Set(fleet.map((v) => v.manager).filter((x): x is string => !!x))]
  // Final subject-exclusion pass: drop any "linked company" that is really the
  // subject — either sharing its Equasis id, or (for management rows Equasis
  // didn't hyperlink a company number to) matching a subject name variant. Uses
  // the fully-captured subject name, so it's order-independent across ships.
  const subjectAliases = new Set([normalise(subjectName ?? resolved.canonicalName), normalise(resolved.canonicalName)])
  const linkedCompanies = [...linkedByKey.values()].filter(
    (lc) => lc.companyImo !== equasisId && !subjectAliases.has(normalise(lc.name)),
  )

  // Second-level crawl: enumerate the closest affiliates' OWN fleets so the
  // relationship picture spans the subject AND its network (mutates in place).
  await expandAffiliateFleets(linkedCompanies, c)

  const companyProfile: CompanyProfile = {
    equasisId,
    name: subjectName ?? resolved.canonicalName,
    // Prefer the address read from the fleet's management chain; fall back to the
    // address carried from resolve (e.g. the picked Equasis search result). The
    // trailing `?? null` guards a re-run of a project resolved before `address`
    // existed (stored JSON lacks the key → undefined, which the schema rejects).
    address: subjectAddress ?? resolved.address ?? null,
    country: resolved.country,
    fleetCount: listed.length,
  }

  // Legacy affiliations (nodes only) so the brief's back-compat field is populated.
  const affiliations: AffiliationGraph = {
    nodes: linkedCompanies.map((lc) => ({ name: lc.name, role: lc.roles[0] ?? "", country: null })),
    edges: [],
  }

  return {
    companyProfile,
    fleet,
    linkedCompanies,
    owners,
    managers,
    detentions,
    affiliations,
    truncated: listed.length > sampleImos.length,
  }
}

/**
 * Enrich the closest affiliates with their OWN fleet (a second-level Equasis
 * crawl). We expand only the top {@link MAX_LINKED_EXPANDED} affiliates — ranked
 * by how many vessels they share with the subject — because each expansion is a
 * throttled Equasis fleet call. Listing-only (no per-vessel ship pages) and
 * best-effort: a failure leaves that affiliate at fleetCount 0 / fleet []. The
 * passed companies are MUTATED in place.
 */
async function expandAffiliateFleets(linkedCompanies: LinkedCompany[], c: NetworkClients): Promise<void> {
  const expandable = linkedCompanies
    .filter((lc): lc is LinkedCompany & { companyImo: string } => lc.companyImo != null)
    .sort((a, b) => b.sharedVesselImos.length - a.sharedVesselImos.length)
    .slice(0, MAX_LINKED_EXPANDED)

  await Promise.all(
    expandable.map((lc) =>
      c.equasis
        .getCompanyFleet(lc.companyImo)
        .then((f) => {
          lc.fleetCount = f.vessels.length
          lc.fleet = f.vessels.slice(0, MAX_AFFILIATE_FLEET_SAMPLE).map((v) => ({
            imo: v.imo, name: v.name, flag: v.flag, type: v.type, registeredOwner: null, manager: null,
          }))
        })
        .catch(() => {
          // Affiliate fleet unavailable (throttle / flaky) — best-effort, leave empty.
        }),
    ),
  )
}

/** Resolve a company name to its Equasis company number (exact match preferred). */
async function findCompanyId(name: string, c: NetworkClients): Promise<string | null> {
  const results = await c.equasis.searchCompaniesByName(name)
  if (results.length === 0) return null
  const q = normalise(name)
  return (results.find((r) => normalise(r.name) === q) ?? results[0]!).id
}

function emptyNetwork(resolved: ResolvedEntity): NetworkResult {
  return {
    companyProfile: { equasisId: null, name: resolved.canonicalName, address: resolved.address ?? null, country: resolved.country, fleetCount: 0 },
    fleet: [],
    linkedCompanies: [],
    owners: [],
    managers: [],
    detentions: [],
    affiliations: { nodes: [], edges: [] },
    truncated: false,
  }
}
