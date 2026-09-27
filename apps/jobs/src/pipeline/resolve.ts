import type { ResolvedEntity } from "@talasa/shared"
import type { EquasisClient } from "@talasa/equasis"
import type { OpenSanctionsClient, ScreeningResult } from "@talasa/opensanctions"
import type { InferenceClient } from "@talasa/inference"
import type { CaseInput } from "./types"

type ResolveClients = Pick<
  {
    equasis: EquasisClient
    opensanctions: OpenSanctionsClient
    inference: InferenceClient
  },
  "equasis" | "opensanctions" | "inference"
>

/**
 * Resolve a fuzzy company name / optional company IMO to a canonical
 * ResolvedEntity. `equasisCompanyId` is the Equasis company number (the same key
 * `getCompanyFleet` and ship management chains use), so the network stage can
 * enumerate the fleet from it whichever path resolved.
 *
 * Deterministic-first algorithm:
 * 1. If a `companyImo` is provided → short path: trust it as the company number,
 *    upgrade the display name via a company-id search (best-effort).
 * 2. Otherwise → run in parallel: OpenSanctions company screen + Equasis name
 *    search. Score candidates by normalised-name equality + country agreement.
 *    Pick the top. If ≥2 equally strong candidates remain, call
 *    inference.choose() to disambiguate.
 */
export async function resolveEntity(
  input: CaseInput,
  c: ResolveClients,
): Promise<ResolvedEntity> {
  if (input.companyImo) {
    return resolveByCompanyImo(input, c)
  }
  return resolveByName(input, c)
}

// ---------------------------------------------------------------------------
// Short path — explicit company IMO / number
// ---------------------------------------------------------------------------

async function resolveByCompanyImo(
  input: CaseInput,
  c: ResolveClients,
): Promise<ResolvedEntity> {
  const companyImo = input.companyImo!

  // When the broker picked a company from Equasis search, we already hold the
  // canonical legal name (queryName) AND its address — trust them and SKIP the
  // company-id lookup entirely. That saves one throttled Equasis request per run
  // (the account is aggressively rate-limited) and pins the exact chosen entity.
  if (input.companyAddress) {
    return {
      canonicalName: input.queryName,
      aliases: [],
      country: input.country,
      address: input.companyAddress,
      equasisCompanyId: companyImo,
      fleetImos: [],
      sanctionsEntityId: null,
      confidence: 0.9,
    }
  }

  // No address (raw company number supplied) — best-effort: look up the company
  // row to upgrade the broker's fuzzy name to Equasis's canonical name + address.
  // A failure keeps the supplied name.
  let canonicalName = input.queryName
  let address: string | null = null
  try {
    const results = await c.equasis.searchCompaniesById(companyImo)
    const exact = results.find((r) => r.id === companyImo) ?? results[0]
    if (exact?.name) canonicalName = exact.name
    if (exact?.address) address = exact.address
  } catch {
    // company-id search unavailable — fall back to the broker-supplied name
  }

  return {
    canonicalName,
    aliases: canonicalName !== input.queryName ? [input.queryName] : [],
    country: input.country,
    address,
    equasisCompanyId: companyImo,
    fleetImos: [],
    sanctionsEntityId: null,
    confidence: 0.85,
  }
}

// ---------------------------------------------------------------------------
// Long path — name search
// ---------------------------------------------------------------------------

interface ScoredCandidate {
  id: string
  name: string
  score: number
  /** True when built from an Equasis CompanyResult; false when synthesised from a sanctions match. */
  isEquasisCandidate: boolean
  sanctionsEntityId: string | null
  decision: ScreeningResult["decision"] | null
}

async function resolveByName(
  input: CaseInput,
  c: ResolveClients,
): Promise<ResolvedEntity> {
  // Run OpenSanctions screen + Equasis name search in parallel. Equasis is
  // aggressively throttled and known-flaky, so a failure there degrades to "no
  // Equasis candidates" (→ the OpenSanctions-hit fallback below still resolves)
  // rather than failing the whole critical resolve stage.
  const [screeningResult, equasisCandidates] = await Promise.all([
    c.opensanctions.screenCompany({ name: input.queryName, country: input.country ?? undefined }),
    c.equasis.searchCompaniesByName(input.queryName).catch(() => []),
  ])

  // Build a scored list from Equasis candidates.
  const normalQuery = normalise(input.queryName)

  const candidates: ScoredCandidate[] = equasisCandidates.map((ec) => {
    let score = 0

    // Exact normalised-name equality is the strongest signal.
    if (normalise(ec.name) === normalQuery) {
      score += 2
    } else if (normalise(ec.name).includes(normalQuery) || normalQuery.includes(normalise(ec.name))) {
      score += 1
    }

    return {
      id: ec.id,
      name: ec.name,
      score,
      isEquasisCandidate: true,
      sanctionsEntityId: null,
      decision: null,
    }
  })

  // Layer in the OpenSanctions result: if there's a direct name match in the
  // screening matches, boost and attach the entity id.
  for (const match of screeningResult.matches) {
    const normMatch = normalise(match.caption)
    const candidate = candidates.find((c) => normalise(c.name) === normMatch)
    if (candidate) {
      candidate.score += match.isMatch ? 2 : 1
      candidate.sanctionsEntityId = match.id
    }
  }
  // If OpenSanctions returned a hit but Equasis has nothing, synthesise a candidate.
  const sanctionHit = screeningResult.matches.find((m) => m.isMatch)
  if (candidates.length === 0 && sanctionHit) {
    candidates.push({
      id: sanctionHit.id,
      name: sanctionHit.caption,
      score: 2,
      isEquasisCandidate: false,
      sanctionsEntityId: sanctionHit.id,
      decision: screeningResult.decision,
    })
  }

  if (candidates.length === 0) {
    // Nothing found — fall back to the raw query name.
    return emptyFallback(input)
  }

  // Sort descending by score.
  candidates.sort((a, b) => b.score - a.score)

  const topScore = candidates[0]!.score
  const strong = candidates.filter((c) => c.score === topScore)

  let chosen: ScoredCandidate

  if (strong.length >= 2) {
    // Tie-break via inference.
    const question = `Which of these companies best matches the query "${input.queryName}"${input.country ? ` (country: ${input.country})` : ""}?`
    const options = strong.map((c) => c.name) as [string, ...string[]]
    const chosenName = await c.inference.choose(question, options)
    chosen = strong.find((s) => s.name === chosenName) ?? strong[0]!
  } else {
    chosen = strong[0]!
  }

  return {
    canonicalName: chosen.name,
    aliases: [],
    country: input.country,
    address: null,
    equasisCompanyId: chosen.isEquasisCandidate ? chosen.id : null,
    fleetImos: [],
    sanctionsEntityId: chosen.sanctionsEntityId,
    confidence: topScore >= 2 ? 0.9 : 0.6,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim()
}

function emptyFallback(input: CaseInput): ResolvedEntity {
  return {
    canonicalName: input.queryName,
    aliases: [],
    country: input.country,
    address: input.companyAddress,
    equasisCompanyId: null,
    fleetImos: [],
    sanctionsEntityId: null,
    confidence: 0.1,
  }
}
