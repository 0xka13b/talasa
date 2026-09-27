import * as Flags from "country-flag-icons/react/3x2"
import type { ComponentType, SVGProps } from "react"
import { cn } from "@/lib/utils"

/**
 * Country/jurisdiction strings in vessel data are free-form (registry
 * exports, manual entry) rather than ISO codes — "Sierra leone", "Cook
 * islands", "Portugal (MAR)", "Virgin Islands (U.K)", or a bare "MH". This
 * maps the variants we've seen (plus common aliases) down to ISO 3166-1
 * alpha-2 so we can look up the matching flag component.
 */
const ALIASES: Record<string, string> = {
  "antigua and barbuda": "AG",
  bahamas: "BS",
  bahrain: "BH",
  barbados: "BB",
  belgium: "BE",
  belize: "BZ",
  bermuda: "BM",
  brazil: "BR",
  cambodia: "KH",
  cameroon: "CM",
  "cayman islands": "KY",
  china: "CN",
  "hong kong": "HK",
  colombia: "CO",
  comoros: "KM",
  "cook islands": "CK",
  "cook island": "CK",
  curacao: "CW",
  cyprus: "CY",
  denmark: "DK",
  ecuador: "EC",
  egypt: "EG",
  "faroe islands": "FO",
  france: "FR",
  gabon: "GA",
  germany: "DE",
  ghana: "GH",
  gibraltar: "GI",
  greece: "GR",
  guernsey: "GG",
  honduras: "HN",
  india: "IN",
  indonesia: "ID",
  iran: "IR",
  "isle of man": "IM",
  israel: "IL",
  italy: "IT",
  jamaica: "JM",
  japan: "JP",
  jersey: "JE",
  kuwait: "KW",
  latvia: "LV",
  lebanon: "LB",
  liberia: "LR",
  lithuania: "LT",
  luxembourg: "LU",
  madeira: "PT",
  malaysia: "MY",
  maldives: "MV",
  malta: "MT",
  "marshall islands": "MH",
  mh: "MH",
  mexico: "MX",
  monaco: "MC",
  morocco: "MA",
  myanmar: "MM",
  netherlands: "NL",
  "new zealand": "NZ",
  nigeria: "NG",
  "north korea": "KP",
  norway: "NO",
  oman: "OM",
  palau: "PW",
  panama: "PA",
  peru: "PE",
  philippines: "PH",
  poland: "PL",
  portugal: "PT",
  qatar: "QA",
  romania: "RO",
  russia: "RU",
  "saudi arabia": "SA",
  senegal: "SN",
  "sierra leone": "SL",
  singapore: "SG",
  "south africa": "ZA",
  "south korea": "KR",
  spain: "ES",
  "sri lanka": "LK",
  "st vincent and grenadines": "VC",
  "st vincent and the grenadines": "VC",
  "saint vincent and the grenadines": "VC",
  sweden: "SE",
  switzerland: "CH",
  taiwan: "TW",
  tanzania: "TZ",
  thailand: "TH",
  togo: "TG",
  tunisia: "TN",
  turkey: "TR",
  tuvalu: "TV",
  ukraine: "UA",
  "united arab emirates": "AE",
  uae: "AE",
  "united kingdom": "GB",
  uk: "GB",
  "united states": "US",
  usa: "US",
  "united states of america": "US",
  uruguay: "UY",
  vanuatu: "VU",
  venezuela: "VE",
  vietnam: "VN",
  "virgin islands": "VG",
  "virgin islands (u.k)": "VG",
  "british virgin islands": "VG",
  yemen: "YE",
  australia: "AU",
}

/** Strips trailing annotations like "Portugal (MAR)" or "Virgin Islands (U.K)" down to the base name. */
function normalize(raw: string): string {
  return raw
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim()
    .toLowerCase()
}

/** Resolves a free-form country/jurisdiction/flag-state string to an ISO 3166-1 alpha-2 code, or null if unrecognized. */
export function countryIsoCode(raw: string | null | undefined): string | null {
  if (!raw) return null
  const key = normalize(raw)
  if (!key || key === "not known") return null
  return ALIASES[key] ?? null
}

/** Renders the small flag icon for a country/jurisdiction string; renders nothing if unrecognized. */
export function CountryFlag({
  country,
  className,
}: {
  country: string | null | undefined
  className?: string
}) {
  const code = countryIsoCode(country)
  if (!code) return null
  const Flag = (Flags as Record<string, ComponentType<SVGProps<SVGSVGElement>>>)[code]
  if (!Flag) return null
  return (
    <Flag
      className={cn("inline-block h-3 w-4 shrink-0 rounded-[1px]", className)}
      aria-label={country ?? undefined}
    />
  )
}
