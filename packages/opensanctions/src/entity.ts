import type { ScreenTarget } from "./types"

/** An FtM "example" entity, the shape POST /match expects per query. */
export interface EntityExample {
  schema: string
  properties: Record<string, string[]>
}

/** Map a screening target to the FtM schema + properties the matcher understands. */
export function targetToExample(target: ScreenTarget): EntityExample {
  if (target.kind === "vessel") {
    const properties = toProps({
      mmsi: target.mmsi,
      name: target.name,
      callSign: target.callSign,
      flag: target.flag,
    })
    // Query the IMO both as the bare number and the FtM-normalized `IMO`-prefixed form.
    // Some source records (e.g. the POI vessel PORTOFINO / IMO 9564671) store only the
    // prefixed identifier, so a bare-number-only query can miss the entity.
    const imoValues = imoQueryValues(target.imo)
    if (imoValues.length > 0) {
      properties.imoNumber = imoValues
    }
    return { schema: "Vessel", properties }
  }
  if (target.kind === "company") {
    return {
      schema: "Company",
      properties: toProps({
        name: target.name,
        country: target.country,
        registrationNumber: target.registrationNumber,
      }),
    }
  }
  return {
    schema: "Person",
    properties: toProps({
      name: target.name,
      nationality: target.country,
      birthDate: target.birthDate,
    }),
  }
}

/**
 * Expand an IMO number into the identifier forms the matcher may need: the bare number
 * and the `IMO`-prefixed form. An existing `IMO` prefix (any case) is normalized first,
 * so callers can pass `"9564671"` or `"IMO9564671"` interchangeably. Returns `[]` for a
 * missing/blank value.
 */
export function imoQueryValues(imo: string | undefined): string[] {
  const bare = imo?.trim().replace(/^imo/i, "").trim()
  if (!bare) {
    return []
  }
  return [bare, `IMO${bare}`]
}

/**
 * Tier-1 (deterministic) vs Tier-3 (name): a vessel queried by IMO/MMSI is a
 * strong-identifier match → a risk hit is decisive; everything else is name-based
 * and routes to human review.
 */
export function isIdentifierTier(target: ScreenTarget): boolean {
  return target.kind === "vessel" && Boolean(target.imo ?? target.mmsi)
}

/** A short label for a result when the caller didn't supply one. */
export function defaultLabel(target: ScreenTarget): string {
  if (target.kind === "vessel") {
    return target.imo ?? target.mmsi ?? target.name ?? "vessel"
  }
  return target.name
}

/** Drop empty values and wrap each present one in the array FtM expects. */
function toProps(values: Record<string, string | undefined>): Record<string, string[]> {
  const props: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(values)) {
    const trimmed = value?.trim()
    if (trimmed) {
      props[key] = [trimmed]
    }
  }
  return props
}
