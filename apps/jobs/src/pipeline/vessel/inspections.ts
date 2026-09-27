import type { Inspection } from "@talasa/equasis"
import type { VesselInspections } from "@talasa/shared"
import type { Clients } from "../../clients"

/**
 * Pull the subject vessel's full port-state-control (PSC) inspection history —
 * the per-report detail (authority, port, date, detention, deficiencies) behind
 * the header detention-rate summary already on VesselIdentity.
 *
 * Best-effort stage: a fetch/parse failure propagates so the orchestrator marks
 * the stage failed and the screening proceeds with only the summary rate.
 */
export async function fetchVesselInspections(imo: string, c: Pick<Clients, "equasis">): Promise<VesselInspections> {
  const { inspections } = await c.equasis.getShipInspections(imo)
  return summariseInspections(inspections)
}

/** Fold raw inspection rows into totals + a normalised record list. */
export function summariseInspections(records: Inspection[]): VesselInspections {
  return {
    total: records.length,
    detentions: records.filter((r) => r.detained).length,
    deficiencies: records.reduce((sum, r) => sum + (r.deficiencies ?? 0), 0),
    records: records.map((r) => ({
      authority: r.authority,
      date: r.date,
      port: r.port,
      detained: r.detained,
      deficiencies: r.deficiencies,
    })),
  }
}
