/**
 * Registry of "suspect" countries whose visits (port calls, sightings, flag
 * changes) warrant highlighting on a vessel screening. Deliberately a small,
 * extensible table — add an entry to flag another country later (e.g. Brazil,
 * Panama). Each entry can carry a `sinceYear` so only visits on/after that year
 * are flagged (Russia since the 2022 sanctions regime), or null to always flag.
 */
export interface SuspectCountry {
  id: string;
  label: string;
  /** Lower-cased substrings matched against a location / authority / flag string. */
  aliases: string[];
  /** Visits on/after this year are flagged; earlier ones are not. null = always. */
  sinceYear: number | null;
}

export const SUSPECT_COUNTRIES: SuspectCountry[] = [
  { id: "russia", label: "Russia", aliases: ["russia", "russian"], sinceYear: 2022 },
  // Iran's comprehensive sanctions long predate our data window, so every visit
  // is flagged (no `sinceYear` threshold).
  { id: "iran", label: "Iran", aliases: ["iran", "iranian"], sinceYear: null },
  // Extend later, e.g.:
  // { id: "brazil", label: "Brazil", aliases: ["brazil"], sinceYear: null },
  // { id: "panama", label: "Panama", aliases: ["panama"], sinceYear: null },
];

/** Pull a 4-digit year out of a free-form date string ("June 2026", "01/03/2023"). */
export function parseYear(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = raw.match(/(19|20)\d{2}/);
  return m ? Number(m[0]) : null;
}

export interface SuspectVisit {
  countryId: string;
  label: string;
  year: number | null;
  /** True when the country matches AND the date meets its `sinceYear` threshold. */
  flagged: boolean;
}

/**
 * Evaluate whether a location/authority/flag string (with an optional date) is a
 * suspect-country visit. Returns the match with `flagged` set per the country's
 * `sinceYear` rule; an unknown date still flags (surfaced for human review).
 * Returns null when no suspect country is mentioned.
 */
export function evaluateSuspectVisit(
  text: string | null | undefined,
  date: string | null | undefined,
): SuspectVisit | null {
  if (!text) return null;
  const hay = text.toLowerCase();
  for (const country of SUSPECT_COUNTRIES) {
    if (!country.aliases.some((a) => hay.includes(a))) continue;
    const year = parseYear(date);
    const flagged = country.sinceYear == null || year == null || year >= country.sinceYear;
    return { countryId: country.id, label: country.label, year, flagged };
  }
  return null;
}
