import type {
  FuzzyMatch,
  GleifAddress,
  GleifCompany,
  GleifNameMatch,
  GleifOwnershipLink,
  LeiRecord,
} from "./types"

function mapAddress(raw: LeiRecord["attributes"]["entity"]["legalAddress"]): GleifAddress | null {
  if (!raw) {
    return null
  }
  return {
    lines: raw.addressLines ?? [],
    city: raw.city ?? null,
    region: raw.region ?? null,
    country: raw.country ?? null,
    postalCode: raw.postalCode ?? null,
  }
}

/** Trim a raw GLEIF lei-record to the valuable domain fields. */
export function mapLeiRecord(rec: LeiRecord): GleifCompany {
  const e = rec.attributes.entity
  return {
    lei: rec.attributes.lei,
    legalName: e.legalName.name,
    otherNames: (e.otherNames ?? []).map((n) => n.name).filter((n): n is string => Boolean(n)),
    jurisdiction: e.jurisdiction ?? null,
    entityStatus: e.status ?? "UNKNOWN",
    registrationStatus: rec.attributes.registration.status ?? "UNKNOWN",
    legalForm: e.legalForm?.id ?? e.legalForm?.other ?? null,
    category: e.category ?? null,
    registeredAs: e.registeredAs ?? null,
    registeredAt: e.registeredAt?.id ?? null,
    address: mapAddress(e.legalAddress),
    headquartersAddress: mapAddress(e.headquartersAddress),
    bic: rec.attributes.bic ?? [],
  }
}

/** Pull {lei, value} out of fuzzy completions, dropping entries with no LEI link. */
export function mapFuzzyMatches(matches: FuzzyMatch[]): GleifNameMatch[] {
  const out: GleifNameMatch[] = []
  for (const m of matches) {
    const lei = m.relationships?.["lei-records"]?.data?.id
    if (lei) {
      out.push({ lei, value: m.attributes.value })
    }
  }
  return out
}

export function toOwnershipLink(company: GleifCompany, relationshipType: string): GleifOwnershipLink {
  return {
    lei: company.lei,
    legalName: company.legalName,
    jurisdiction: company.jurisdiction,
    relationshipType,
  }
}

/** Lowercase, strip diacritics + punctuation, collapse whitespace. */
export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function matchConfidence(query: string, value: string): "exact" | "fuzzy" {
  return normalizeName(query) === normalizeName(value) ? "exact" : "fuzzy"
}
