import type { HistoryEntry } from "@talasa/equasis"
import type { VesselHistory } from "@talasa/shared"
import type { Clients } from "../../clients"

/**
 * Pull the subject vessel's Equasis change history — every name, flag,
 * classification-society and company-role change on record — and fold it into
 * distinct flag/name sequences plus change counts. Flag-hopping and re-naming
 * are classic shadow-fleet indicators a point-in-time identity snapshot hides.
 *
 * Best-effort stage: a fetch/parse failure propagates so the orchestrator marks
 * the stage failed and the screening proceeds without a history section.
 */
export async function fetchVesselHistory(imo: string, c: Pick<Clients, "equasis">): Promise<VesselHistory> {
  const { entries } = await c.equasis.getShipHistory(imo)
  return summariseHistory(entries)
}

/** Fold raw history rows into distinct flag/name sequences + change counts. */
export function summariseHistory(entries: HistoryEntry[]): VesselHistory {
  const flags = distinct(entries.filter((e) => e.kind === "flag").map((e) => e.value))
  const names = distinct(entries.filter((e) => e.kind === "name").map((e) => e.value))
  return {
    flags,
    names,
    flagChanges: Math.max(0, flags.length - 1),
    nameChanges: Math.max(0, names.length - 1),
    entries: entries.map((e) => ({ kind: e.kind, value: e.value, from: e.from })),
  }
}

/** Non-null values, de-duplicated, preserving first-seen order. */
function distinct(values: (string | null)[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    if (v == null || seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}
