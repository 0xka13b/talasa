import type { AisBehavior, AisBrief, AisEvent, AisScoreInputs, UndisclosedOwnershipFlag, VesselEvidence, VesselHistory, VesselIdentity, VesselInspections, VesselSignal } from "@talasa/shared"
import { aisScoreInputs, computeVesselVerdict, emptyAisBehavior, evaluateSuspectVisit, isStsImplausibleVesselType } from "@talasa/shared"
import type { GeographyEntry } from "@talasa/equasis"
import type { FleetResult, ManagementCompany } from "./types"
import type { VesselSanctionsResult } from "./sanctions"
import type { EnrichedCompany } from "./enrich"
import { buildGraph, nodeCategories } from "./graph"
import type { EntityGraph } from "@talasa/shared"

// `ais_history` and `mou_psc_detail` are added conditionally (only when the AIS /
// inspection stages could not run).
const STRUCTURAL_GAPS = ["beneficial_owner"]
const AIS_EVENT_CAP = 25

function parsePercent(raw: string | null): number | null {
  if (!raw) return null
  const m = raw.match(/(\d+(?:\.\d+)?)\s*%/)
  return m ? Number(m[1]) : null
}

function mouListed(value: string | null): boolean {
  return value ? /black|grey|gray/i.test(value) : false
}

export function assembleVesselEvidence(
  identity: VesselIdentity,
  companies: ManagementCompany[],
  fleet: FleetResult,
  sanctions: VesselSanctionsResult,
  failedStages: string[],
  enriched: EnrichedCompany[] = [],
  history: VesselHistory | null = null,
  inspections: VesselInspections | null = null,
  ais: AisBehavior = emptyAisBehavior(false),
  geography: GeographyEntry[] = [],
  undisclosedFlags: UndisclosedOwnershipFlag[] = [],
): { evidence: VesselEvidence; graph: EntityGraph } {
  // One canonical category per node (shared with the graph) → `sanctioned` means
  // strictly "directly sanctioned"; POI/linked carry their category instead.
  const categoryByNode = nodeCategories(sanctions.matches)
  const categoryOf = (id: string) => categoryByNode.get(id) ?? null
  const isSanctioned = (id: string) => categoryOf(id) === "sanctioned"
  const enrichByKey = new Map(enriched.map((e) => [e.key, e]))
  const enrichmentUnavailable = failedStages.includes("enrich")
  const parentSanctionedKeys = new Set(sanctions.parentHits.map((p) => p.subsidiaryKey))
  const companyNameByKey = new Map(companies.map((co) => [co.companyImo ?? co.name, co.name]))
  const detentionPct = parsePercent(identity.detentionRate)
  const highDetention = detentionPct != null && detentionPct >= 10
  const mouBlackOrGrey = mouListed(identity.parisMou) || mouListed(identity.tokyoMou)
  const sanctionsUnavailable = sanctions.unavailable || failedStages.includes("sanctions")
  // Yachts, pleasure craft and fishing vessels loiter as a matter of course
  // (leisure anchoring, working the grounds), so their stops are not ship-to-ship
  // transfer candidates — drop the STS classification for those types to keep the
  // report free of false positives. The loiter data itself is left untouched.
  const aisScored = isStsImplausibleVesselType(identity.type)
    ? { ...ais, loiters: ais.loiters.map((l) => ({ ...l, stsCandidate: false })) }
    : ais
  const aisInputs = aisScoreInputs(aisScored)

  // ---- suspect-country tagging (Russia on/after 2022; registry-extensible) ----
  const briefGeography = geography.map((g) => {
    const v = evaluateSuspectVisit(g.area, g.date)
    const suspect = v?.flagged === true
    return { date: g.date, area: g.area, source: g.source, suspect, suspectLabel: suspect && v ? v.label : null }
  })
  const suspectAreaVisit = briefGeography.some((g) => g.suspect)

  // Only tag rows that ARE suspect — leave the rest untouched (fields are
  // optional), so a non-suspect brief matches the raw fetch exactly.
  const enrichedInspections = inspections
    ? {
        ...inspections,
        records: inspections.records.map((r) => {
          const v = evaluateSuspectVisit(r.authority, r.date)
          return v?.flagged ? { ...r, suspect: true, suspectLabel: v.label } : r
        }),
      }
    : null
  const suspectPortCallCount = enrichedInspections ? enrichedInspections.records.filter((r) => r.suspect).length : 0

  const enrichedHistory = history
    ? {
        ...history,
        entries: history.entries.map((e) => {
          const v = e.kind === "flag" ? evaluateSuspectVisit(e.value, e.from) : null
          return v?.flagged ? { ...e, suspect: true, suspectLabel: v.label } : e
        }),
      }
    : null

  const verdict = computeVesselVerdict({
    subjectSanction: sanctions.subjectSeverity,
    managementSanction: sanctions.managementSeverity,
    parentSanction: sanctions.parentSeverity,
    directSisterCount: sanctions.directSisterCount,
    linkedSisterCount: sanctions.linkedSisterCount,
    riskyFlag: identity.riskyFlag,
    highDetention,
    mouBlackOrGrey,
    subjectReviewMatch: sanctions.subjectReviewMatch,
    subjectPoi: sanctions.subjectPoi,
    suspectPortCallCount,
    suspectAreaVisit,
    sanctionsUnavailable,
    ...aisInputs,
  })

  const signals: VesselSignal[] = []
  // Direct designation is blocking; a link is a strong (not blocking) signal.
  if (sanctions.subjectSeverity === "direct") signals.push({ kind: "subject_sanction", severity: "blocking", detail: `Subject vessel IMO ${identity.imo} is on a sanctions list` })
  else if (sanctions.subjectSeverity === "linked") signals.push({ kind: "subject_sanction_linked", severity: "strong", detail: `Subject vessel IMO ${identity.imo} is linked to a sanctioned entity` })
  // Person/entity of interest (e.g. shadow-fleet vessel) — carry the OpenSanctions
  // designation narrative as the signal detail so the "why" isn't lost.
  if (sanctions.subjectPoi) {
    const poi = sanctions.matches.find((m) => m.nodeId === `imo:${identity.imo}` && (m.category === "poi" || m.category === "pep"))
    signals.push({ kind: "subject_poi", severity: "strong", detail: poi?.description ? `Subject is a person/entity of interest — ${poi.description}` : "Subject vessel is listed as a person/entity of interest" })
  }
  if (sanctions.managementSeverity === "direct") signals.push({ kind: "management_sanction", severity: "blocking", detail: `Sanctioned management company: ${sanctions.companyHits.join(", ")}` })
  else if (sanctions.managementSeverity === "linked") signals.push({ kind: "management_sanction_linked", severity: "strong", detail: `Management company linked to a sanctioned entity: ${sanctions.companyHits.join(", ")}` })
  for (const s of sanctions.sisterHits) signals.push({ kind: "sister_sanction", severity: "strong", detail: `Sister vessel IMO ${s.imo}${s.name ? ` (${s.name})` : ""} tied to sanctions` })
  for (const p of sanctions.parentHits) signals.push({ kind: "parent_sanction", severity: sanctions.parentSeverity === "direct" ? "strong" : "weak", detail: `Parent owner tied to sanctions: ${p.name} (owns ${companyNameByKey.get(p.subsidiaryKey) ?? p.subsidiaryKey})` })
  if (highDetention) signals.push({ kind: "detention_rate", severity: "strong", detail: `Detention rate ${identity.detentionRate}` })
  if (mouBlackOrGrey) signals.push({ kind: "mou_listed", severity: "weak", detail: `MoU listing: Paris ${identity.parisMou ?? "—"} / Tokyo ${identity.tokyoMou ?? "—"}` })
  if (identity.riskyFlag) signals.push({ kind: "risky_flag", severity: "weak", detail: `High-risk flag of convenience: ${identity.flag}` })
  if (sanctions.subjectReviewMatch) signals.push({ kind: "name_review", severity: "weak", detail: "Name-tier sanctions match on the subject (unconfirmed)" })
  if (sanctionsUnavailable) signals.push({ kind: "sanctions_unavailable", severity: "weak", detail: "Sanctions screening could not be completed" })
  // Undisclosed / unknown registry ownership is a deliberate concealment tactic
  // (a shadow-fleet indicator). Descriptive only — it does not move the score.
  for (const f of undisclosedFlags) {
    signals.push({ kind: "undisclosed_ownership", severity: "strong", detail: `${f.role} ownership is undisclosed on the registry ("${f.placeholder}")` })
  }
  // Repeated flag / name changes are shadow-fleet indicators. Descriptive weak
  // signals only — they inform the LLM narrative but do not move the verdict.
  if (history && history.flagChanges >= 2) {
    signals.push({ kind: "flag_hopping", severity: "weak", detail: `Flown ${history.flags.length} flags (${history.flagChanges} changes on record): ${history.flags.join(", ")}` })
  }
  if (history && history.nameChanges >= 2) {
    signals.push({ kind: "name_change", severity: "weak", detail: `Renamed ${history.nameChanges} times: ${history.names.join(", ")}` })
  }
  // AIS behavioural signals (suspected, never dispositive).
  if (aisInputs.darkGapInHighRiskZone) signals.push({ kind: "ais_dark_gap", severity: "strong", detail: "AIS transmission gap in a high-risk STS zone" })
  else if (aisInputs.darkGapCount > 0) signals.push({ kind: "ais_dark_gap", severity: "weak", detail: `${aisInputs.darkGapCount} AIS transmission gap(s) of 6h or more` })
  if (aisInputs.stsCandidateCount > 0) signals.push({ kind: "sts_candidate", severity: "weak", detail: `${aisInputs.stsCandidateCount} suspected ship-to-ship loitering event(s) — counterparty unconfirmed` })
  if (aisInputs.speedAnomalyCount > 0) signals.push({ kind: "ais_speed_anomaly", severity: "weak", detail: `${aisInputs.speedAnomalyCount} implausible-speed segment(s) — possible position spoofing` })
  // Suspect-country activity (e.g. Russia port calls / sightings / flags after 2022).
  for (const insp of (enrichedInspections?.records ?? []).filter((r) => r.suspect).slice(0, 5)) {
    signals.push({ kind: "suspect_port_call", severity: "strong", detail: `PSC inspection in ${insp.suspectLabel}${insp.port ? ` — ${insp.port}` : ""}${insp.date ? ` (${insp.date})` : ""}` })
  }
  if (suspectAreaVisit) {
    const labels = [...new Set(briefGeography.filter((g) => g.suspect && g.suspectLabel).map((g) => g.suspectLabel))]
    signals.push({ kind: "suspect_area", severity: "weak", detail: `Recent geographic sighting in a ${labels.join(", ")}-associated area` })
  }
  for (const e of (enrichedHistory?.entries ?? []).filter((e) => e.kind === "flag" && e.suspect)) {
    signals.push({ kind: "suspect_flag", severity: "weak", detail: `Flag change to ${e.suspectLabel}${e.value ? ` (${e.value})` : ""}${e.from ? ` since ${e.from}` : ""}` })
  }

  const briefCompanies = companies.map((co) => {
    const key = co.companyImo ?? co.name
    const e = enrichByKey.get(key)
    const id = co.companyImo ? `company:${co.companyImo}` : `company:${co.name}`
    return {
      companyImo: co.companyImo, role: co.role, roles: co.roles, name: co.name, address: co.address,
      sanctioned: isSanctioned(id),
      category: categoryOf(id),
      lei: e?.lei ?? null,
      legalName: e?.legalName ?? null,
      jurisdiction: e?.jurisdiction ?? null,
      registrationStatus: e?.registrationStatus ?? null,
      directParent: e?.directParent ? { lei: e.directParent.lei, legalName: e.directParent.legalName, jurisdiction: e.directParent.jurisdiction } : null,
      ultimateParent: e?.ultimateParent ? { lei: e.ultimateParent.lei, legalName: e.ultimateParent.legalName, jurisdiction: e.ultimateParent.jurisdiction } : null,
      parentSanctioned: parentSanctionedKeys.has(key),
    }
  })

  const briefFleet: VesselEvidence["fleet"] = {
    companies: fleet.companies.map((fc) => ({
      companyImo: fc.companyImo, name: fc.name, vesselCount: fc.vesselCount, sampledCount: fc.sampledCount,
      sanctionedCount: fc.sisters.filter((s) => isSanctioned(`imo:${s.imo}`)).length,
    })),
    sisters: fleet.sisters.map((s) => ({ imo: s.imo, name: s.name, flag: s.flag, type: s.type, sanctioned: isSanctioned(`imo:${s.imo}`), category: categoryOf(`imo:${s.imo}`) })),
    truncated: fleet.truncated,
    note: fleet.note,
  }

  // PSC / AIS detail are only gaps when their stages could not run.
  const inspectionsUnavailable = failedStages.includes("inspections") || !inspections
  const aisBrief = buildAisBrief(aisScored, aisInputs)
  const gaps = [...new Set([
    ...STRUCTURAL_GAPS,
    ...(inspectionsUnavailable ? ["mou_psc_detail"] : []),
    ...failedStages,
    ...(enrichmentUnavailable ? ["company_ownership"] : []),
    ...(ais.available ? [] : ["ais_history"]),
  ])]
  const sourcesOk: string[] = ["equasis_identity"]
  if (!failedStages.includes("history") && history) sourcesOk.push("equasis_history")
  if (!inspectionsUnavailable) sourcesOk.push("equasis_inspections")
  if (!failedStages.includes("fleet")) sourcesOk.push("equasis_fleet")
  if (!sanctionsUnavailable) sourcesOk.push("opensanctions")
  if (ais.available) sourcesOk.push("datalastic_ais")

  const evidence: VesselEvidence = {
    imo: identity.imo,
    identity,
    history: enrichedHistory,
    inspections: enrichedInspections,
    geography: briefGeography,
    companies: briefCompanies,
    fleet: briefFleet,
    sanctions: {
      status: sanctions.status, subjectHit: sanctions.subjectHit, companyHits: sanctions.companyHits,
      sisterHits: sanctions.sisterHits, matches: sanctions.matches,
    },
    parentHits: sanctions.parentHits,
    undisclosedOwnership: undisclosedFlags,
    ais: aisBrief,
    signals,
    verdict,
    dataCompleteness: { sourcesOk, gaps },
  }

  const graph = buildGraph(identity, companies, fleet, sanctions.matches, enriched)
  return { evidence, graph }
}

/** Flatten the deterministic AIS behaviour result into the brief's `ais` block. */
function buildAisBrief(ais: AisBehavior, inputs: AisScoreInputs): AisBrief {
  const events: AisEvent[] = [
    ...ais.darkGaps.map((g): AisEvent => ({
      kind: "dark_gap", startUtc: g.fromUtc, endUtc: g.toUtc, durationHours: g.durationHours,
      distanceNm: g.distanceNm, impliedSpeedKn: g.impliedSpeedKn, lat: g.fromLat, lon: g.fromLon, highRiskArea: g.highRiskArea,
    })),
    ...ais.loiters.filter((l) => l.stsCandidate).map((l): AisEvent => ({
      kind: "sts_candidate", startUtc: l.fromUtc, endUtc: l.toUtc, durationHours: l.durationHours,
      distanceNm: null, impliedSpeedKn: null, lat: l.lat, lon: l.lon, highRiskArea: l.highRiskArea,
    })),
    ...ais.speedAnomalies.map((s): AisEvent => ({
      kind: "speed_anomaly", startUtc: s.fromUtc, endUtc: s.toUtc, durationHours: null,
      distanceNm: s.distanceNm, impliedSpeedKn: s.impliedSpeedKn, lat: null, lon: null, highRiskArea: null,
    })),
  ]
  // High-risk-zone events first, then most extreme (fastest / longest).
  events.sort((a, b) =>
    Number(Boolean(b.highRiskArea)) - Number(Boolean(a.highRiskArea)) ||
    (b.impliedSpeedKn ?? b.durationHours ?? 0) - (a.impliedSpeedKn ?? a.durationHours ?? 0),
  )

  return {
    available: ais.available,
    positionCount: ais.positionCount,
    spanDays: ais.spanDays,
    darkGapCount: inputs.darkGapCount,
    stsCandidateCount: inputs.stsCandidateCount,
    speedAnomalyCount: inputs.speedAnomalyCount,
    highRiskZoneActivity: inputs.darkGapInHighRiskZone,
    events: events.slice(0, AIS_EVENT_CAP),
    truncated: events.length > AIS_EVENT_CAP,
    summary: summarizeAis(ais, inputs),
  }
}

function summarizeAis(ais: AisBehavior, inputs: AisScoreInputs): string {
  if (!ais.available) return "No AIS behavioural history was available for the analysed window."
  const parts = [`${ais.positionCount} positions over ${ais.spanDays} days`]
  if (inputs.darkGapCount > 0) parts.push(`${inputs.darkGapCount} dark gap(s)`)
  if (inputs.stsCandidateCount > 0) parts.push(`${inputs.stsCandidateCount} suspected STS loiter(s)`)
  if (inputs.speedAnomalyCount > 0) parts.push(`${inputs.speedAnomalyCount} speed anomal(ies)`)
  if (inputs.darkGapInHighRiskZone) parts.push("activity in a high-risk STS zone")
  return `${parts.join("; ")}.`
}
