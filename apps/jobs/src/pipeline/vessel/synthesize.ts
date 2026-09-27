import type { AisBrief, AisBehavior, AisEvent, EntityGraph, InferredOwnership, VesselBrief, VesselEvidence, VesselBriefLLMFields, VesselHistory, VesselInspections, VesselIdentity } from "@talasa/shared"
import { emptyAisBehavior } from "@talasa/shared"
import type { GeographyEntry } from "@talasa/equasis"
import type { InferenceClient, Usage } from "@talasa/inference"
import type { GeocodeClient } from "../../geocode"
import type { FleetResult, ManagementCompany } from "./types"
import type { VesselSanctionsResult } from "./sanctions"
import type { EnrichedCompany } from "./enrich"
import { assembleVesselEvidence } from "./evidence"
import { resolveMaritime } from "./maritime"

interface SynthClients {
  inference: InferenceClient
  geocoder?: GeocodeClient | null
}

export async function synthesizeVessel(
  imo: string,
  identity: VesselIdentity,
  companies: ManagementCompany[],
  fleet: FleetResult,
  sanctions: VesselSanctionsResult,
  c: SynthClients,
  failedStages: string[] = [],
  screeningId?: string,
  enriched: EnrichedCompany[] = [],
  history: VesselHistory | null = null,
  inspections: VesselInspections | null = null,
  ais: AisBehavior = emptyAisBehavior(false),
  geography: GeographyEntry[] = [],
  inferredOwnership: InferredOwnership | null = null,
): Promise<{ brief: VesselBrief; graph: EntityGraph; usage: Usage }> {
  const { evidence, graph } = assembleVesselEvidence(identity, companies, fleet, sanctions, failedStages, enriched, history, inspections, ais, geography, inferredOwnership?.flags ?? [])
  // Resolve a location for each AIS event: a deterministic maritime place always,
  // plus a Google reverse-geocoded label when a key is set. Independent of the
  // LLM call, so run it alongside synthesis.
  const [{ fields, usage }, enrichedAis] = await Promise.all([
    c.inference.synthesizeVesselBrief(evidence),
    enrichAisEvents(evidence.ais, c.geocoder),
  ])
  evidence.ais = enrichedAis
  const brief = mergeVesselBrief(imo, evidence, fields, usage, screeningId, inferredOwnership)
  return { brief, graph, usage }
}

/**
 * Attach a location to each AIS event that has coordinates:
 *  - `maritime`: deterministic (nearest port + bearing, sea, EEZ), always computed;
 *  - `place`: Google reverse-geocode, only when a geocoder (key) is configured.
 * Both are best-effort — geocode failures resolve to `null` inside the client and
 * maritime resolution never throws — so this always returns the brief.
 */
async function enrichAisEvents(
  ais: AisBrief | null | undefined,
  geocoder: GeocodeClient | null | undefined,
): Promise<AisBrief | null | undefined> {
  if (!ais || ais.events.length === 0) return ais
  const events: AisEvent[] = await Promise.all(
    ais.events.map(async (e): Promise<AisEvent> => {
      if (e.lat == null || e.lon == null) return e
      const maritime = resolveMaritime(e.lat, e.lon)
      const place = geocoder ? await geocoder.reverseGeocode(e.lat, e.lon) : (e.place ?? null)
      return { ...e, place, maritime }
    }),
  )
  return { ...ais, events }
}

function mergeVesselBrief(
  imo: string, evidence: VesselEvidence, fields: VesselBriefLLMFields, usage: Usage, screeningId?: string,
  inferredOwnership: InferredOwnership | null = null,
): VesselBrief {
  const now = new Date().toISOString()
  const v = evidence.verdict
  return {
    screeningId: screeningId ?? `vs_${now.slice(0, 10).replace(/-/g, "")}_${imo}`,
    imo,
    generatedAt: now,
    reportVersion: "1.0",
    identity: evidence.identity,
    history: evidence.history ?? null,
    inspections: evidence.inspections ?? null,
    geography: evidence.geography,
    companies: evidence.companies,
    fleet: evidence.fleet,
    sanctions: { ...evidence.sanctions, narrative: fields.sanctionsNarrative },
    inferredOwnership: inferredOwnership ?? null,
    ais: evidence.ais ?? null,
    signals: evidence.signals,
    // Verdict is deterministic; the LLM cannot override decision/score/drivers.
    verdict: { decision: v.decision, score: v.score, drivers: v.drivers, justification: `Verdict ${v.decision} (score ${v.score}/100). Drivers: ${v.drivers.join(", ") || "none"}.` },
    executiveSummary: fields.executiveSummary,
    prediction: fields.prediction,
    recommendation: fields.recommendation,
    dataCompleteness: evidence.dataCompleteness,
    modelMeta: { model: usage.model, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, cachedTokens: usage.cachedTokens },
  }
}

// ---- helpers for recurring monitoring --------------------------------------
// A monitor run assembles the deterministic brief cheaply to compute a change
// snapshot, and only pays for the LLM narrative when something actually changed.
const EMPTY_LLM_FIELDS: VesselBriefLLMFields = { executiveSummary: "", sanctionsNarrative: "", prediction: "", recommendation: "" }
const ZERO_USAGE: Usage = { model: "", inputTokens: 0, outputTokens: 0, cachedTokens: 0 }

/** The fully deterministic brief (identity, verdict, sanctions, fleet, …) with
 * blank narrative — enough to compute a watch snapshot without an LLM call. */
export function deterministicBrief(
  imo: string, evidence: VesselEvidence, screeningId?: string, inferredOwnership: InferredOwnership | null = null,
): VesselBrief {
  return mergeVesselBrief(imo, evidence, EMPTY_LLM_FIELDS, ZERO_USAGE, screeningId, inferredOwnership)
}

/** Run the LLM narration (+ AIS geocoding) over already-assembled evidence and
 * merge it into a finished brief. Mirrors the tail of {@link synthesizeVessel},
 * exposed so a monitor run can defer it until a change is detected. */
export async function narrateVesselBrief(
  imo: string, evidence: VesselEvidence, c: SynthClients, screeningId?: string, inferredOwnership: InferredOwnership | null = null,
): Promise<{ brief: VesselBrief; usage: Usage }> {
  const [{ fields, usage }, enrichedAis] = await Promise.all([
    c.inference.synthesizeVesselBrief(evidence),
    enrichAisEvents(evidence.ais, c.geocoder),
  ])
  evidence.ais = enrichedAis
  const brief = mergeVesselBrief(imo, evidence, fields, usage, screeningId, inferredOwnership)
  return { brief, usage }
}
