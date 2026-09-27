import { analyzeTrack, emptyAisBehavior, type AisBehavior, type AisFix } from "@talasa/shared"
import type { VesselPosition } from "@talasa/datalastic"
import type { Clients } from "../../clients"

type AisClients = Pick<Clients, "datalastic">

function toFix(p: VesselPosition): AisFix {
  return { lat: p.lat, lon: p.lon, speed: p.speed, epoch: p.epoch, timeUtc: p.timeUtc, navStatus: p.navStatus }
}

/**
 * Fetch the vessel's AIS track from Datalastic and run the deterministic
 * behaviour detectors (dark gaps, STS-candidate loitering, speed anomalies).
 *
 * Best-effort semantics:
 *  - no provider configured (no API key) → `available:false` (a data gap, not a failure);
 *  - unknown vessel / empty track       → `available:false`;
 *  - network / HTTP / timeout error      → throws, so the orchestrator marks the
 *    stage failed and the evidence records the `ais_history` gap.
 *
 * Cost: `/vessel_history` bills ~1 credit per day of the window (90 days ≈ 90 credits).
 */
export async function analyzeVesselAis(
  imo: string,
  c: AisClients,
  opts: { days?: number } = {},
): Promise<AisBehavior> {
  if (!c.datalastic) return emptyAisBehavior(false)
  const track = await c.datalastic.getVesselHistory({ imo }, { days: opts.days ?? 90 })
  if (!track || track.positions.length === 0) return emptyAisBehavior(false)
  return analyzeTrack(track.positions.map(toFix))
}
