/**
 * Shared helpers for rendering AIS behaviour events on a map — used by both the
 * interactive report panel (Google Maps JS API) and the PDF export (Google
 * Static Maps API). Keeping the kind→colour/label mapping and the static-map URL
 * builder here means the web map and the printed map stay visually consistent.
 */
import type { AisEvent } from "@talasa/shared"

/** Browser-exposed Google Maps key (JS API + Static Maps + client geocoding). */
export const GOOGLE_MAPS_KEY: string =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? ""

export type AisEventKind = AisEvent["kind"]

/** A point on the map: an AIS event guaranteed to have coordinates. */
export type AisPoint = AisEvent & { lat: number; lon: number }

/** Events that carry coordinates (speed anomalies have none and are dropped). */
export function mappableEvents(events: AisEvent[]): AisPoint[] {
  return events.filter((e): e is AisPoint => e.lat != null && e.lon != null)
}

export const KIND_LABEL: Record<AisEventKind, string> = {
  dark_gap: "Dark gap",
  sts_candidate: "STS candidate",
  speed_anomaly: "Speed anomaly",
}

/** Marker/legend colour per event kind (hex, shared with the PDF static map). */
export const KIND_COLOR: Record<AisEventKind, string> = {
  dark_gap: "#f59e0b", // amber — transmission gap
  sts_candidate: "#dc2626", // red — suspected ship-to-ship
  speed_anomaly: "#7c3aed", // violet — implausible speed / spoofing
}

/**
 * Best available location for an event, split into a primary line and muted
 * secondary context. Prefers the Google place label (coastal points); falls back
 * to the deterministic maritime fix ("82 nm SW of Freetown, Sierra Leone") for
 * open water; finally to raw coordinates.
 */
export function locationLabel(e: AisEvent): {
  primary: string
  secondary: string | null
} {
  const m = e.maritime
  const portPhrase =
    m?.nearestPort && m.distanceNm != null && m.bearing
      ? `${m.distanceNm} nm ${m.bearing} of ${m.nearestPort}`
      : null
  const coords =
    e.lat != null && e.lon != null
      ? `${e.lat.toFixed(3)}, ${e.lon.toFixed(3)}`
      : null
  const primary = e.place ?? portPhrase ?? coords ?? "Position unknown"

  const context: string[] = []
  if (m?.sea) context.push(m.sea)
  // EEZ echoes the country a Google place already names, so only add it offshore.
  if (!e.place && m?.eez) context.push(m.eez)
  return { primary, secondary: context.length ? context.join(" · ") : null }
}

/** Single-line location for compact contexts (map popup, PDF cell). */
export function locationOneLine(e: AisEvent): string {
  const { primary, secondary } = locationLabel(e)
  return secondary ? `${primary} · ${secondary}` : primary
}

/** Human summary line for one event (times + the metric that matters for its kind). */
export function eventDetail(e: AisEvent): string {
  const parts: string[] = []
  if (e.durationHours != null) parts.push(`${e.durationHours}h`)
  if (e.kind === "dark_gap" && e.distanceNm != null)
    parts.push(`${e.distanceNm} nm gap`)
  if (e.impliedSpeedKn != null) parts.push(`${e.impliedSpeedKn} kn implied`)
  return parts.join(" · ")
}

const UTC_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

/** `17 Jul, 2025 14:30` (UTC) for a report timestamp, or an em dash. */
export function shortUtc(iso: string | null): string {
  if (!iso) return "—"
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  const time = iso.slice(11, 16)
  if (m) {
    const mon = UTC_MONTHS[Number(m[2]) - 1]
    if (mon) return `${Number(m[3])} ${mon}, ${m[1]}${time ? ` ${time}` : ""}`
  }
  return `${iso.slice(0, 10)} ${time}`.trim()
}

/**
 * Build a Google Static Maps URL plotting every mappable event, coloured by
 * kind. Returns null when there's no key or no point (caller then omits the
 * image). Markers are grouped per colour, since the Static Maps API sets one
 * colour per `markers=` group.
 */
export function staticMapUrl(
  events: AisEvent[],
  opts: { width?: number; height?: number; scale?: number } = {}
): string | null {
  const points = mappableEvents(events)
  if (!GOOGLE_MAPS_KEY || points.length === 0) return null
  const { width = 640, height = 360, scale = 2 } = opts

  const byColor = new Map<string, AisPoint[]>()
  for (const p of points) {
    const color = KIND_COLOR[p.kind]
    const list = byColor.get(color) ?? []
    list.push(p)
    byColor.set(color, list)
  }

  const params = new URLSearchParams()
  params.set("size", `${width}x${height}`)
  params.set("scale", String(scale))
  params.set("maptype", "roadmap")
  params.set("key", GOOGLE_MAPS_KEY)

  const parts: string[] = []
  for (const [color, list] of byColor) {
    const hex = color.replace("#", "0x")
    const coords = list
      .map((p) => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`)
      .join("|")
    parts.push(`size:small|color:${hex}|${coords}`)
  }
  // URLSearchParams encodes the pipes; Static Maps accepts encoded markers.
  for (const m of parts) params.append("markers", m)

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
}
