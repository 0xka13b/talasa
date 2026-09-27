import { z } from "zod"
import type { VesselBrief } from "./vessel.js"
import { VESSEL_VERDICTS, type VesselVerdict } from "./vessel.js"

/**
 * Change-detection core for recurring vessel monitoring.
 *
 * A monitor re-runs a screening on a schedule and needs to answer "did anything
 * that matters change since last time?". Hashing the whole `brief` is wrong: it
 * carries LLM prose, timestamps, token counts, and AIS positions that jitter on
 * every run, so a raw-brief hash flips constantly and says nothing useful.
 *
 * Instead we project the brief down to a small, deterministic **watch snapshot**
 * of just the facts worth watching, sort every list into a stable order, and:
 *   - {@link hashSnapshot} fingerprints it per-facet (fast "did facet X change?"),
 *   - {@link diffSnapshots} produces a human, facet-scoped diff of what changed.
 *
 * This module is pure and isomorphic (no node:crypto) so the browser can render
 * the same diff the worker computes.
 */

// ---- facets ----------------------------------------------------------------
/** The watchable dimensions of a screening. `verdict` is always evaluated (it is
 * the headline / escalation signal); the rest are gated by the monitor's checks. */
export const WATCH_FACETS = [
  "verdict",
  "sanctions",
  "ownership",
  "inferredOwnership",
  "ais",
  "inspections",
  "fleet",
  "flag",
] as const
export type WatchFacet = (typeof WATCH_FACETS)[number]

// ---- snapshot shape --------------------------------------------------------
const sanctionItemSchema = z.object({
  /** Stable identity key for set diffing (nodeId when present, else entity|list). */
  key: z.string(),
  entity: z.string(),
  list: z.string(),
  category: z.string().nullable(),
  tier: z.enum(["hit", "review"]),
})
const ownershipItemSchema = z.object({
  key: z.string(),
  name: z.string(),
  role: z.string(),
  imo: z.string().nullable(),
  sanctioned: z.boolean(),
})
const inferredItemSchema = z.object({
  key: z.string(),
  name: z.string(),
  role: z.string(),
  strength: z.enum(["strong", "moderate", "weak"]),
})

export const watchSnapshotSchema = z.object({
  verdict: z.object({ decision: z.enum(VESSEL_VERDICTS), score: z.number() }).nullable(),
  sanctions: z.array(sanctionItemSchema),
  ownership: z.array(ownershipItemSchema),
  inferredOwnership: z.array(inferredItemSchema),
  ais: z
    .object({
      darkGaps: z.number(),
      stsCandidates: z.number(),
      speedAnomalies: z.number(),
      highRiskZone: z.boolean(),
    })
    .nullable(),
  inspections: z.object({ detentions: z.number(), deficiencies: z.number() }).nullable(),
  fleetHits: z.object({ direct: z.number(), linked: z.number() }),
  flag: z.string().nullable(),
})
export type WatchSnapshot = z.infer<typeof watchSnapshotSchema>

// ---- change shape ----------------------------------------------------------
export const watchChangeSchema = z.object({
  facet: z.enum(WATCH_FACETS),
  kind: z.enum(["added", "removed", "changed"]),
  /** Human, source-agnostic one-liner for the change feed. */
  label: z.string(),
  before: z.string().nullable(),
  after: z.string().nullable(),
  /** True when the change is a WORSENING (verdict up, new direct designation, new
   * detention, more sanctioned sisters) — drives "escalations only" notifications. */
  escalation: z.boolean(),
})
export type WatchChange = z.infer<typeof watchChangeSchema>

// ---- building the snapshot from a brief -------------------------------------
const cat = (c: string | null | undefined): string | null => c ?? null

/** Project a completed brief into its canonical watch snapshot. Every list is
 * sorted by its stable key so equal facts always hash and diff identically. */
export function buildWatchSnapshot(brief: VesselBrief): WatchSnapshot {
  const sanctions = (brief.sanctions?.matches ?? [])
    .map((m) => ({
      key: m.nodeId || `${m.entity}|${m.list}`,
      entity: m.entity,
      list: m.list,
      category: cat(m.category),
      tier: m.tier,
    }))
    .sort((a, b) => a.key.localeCompare(b.key))

  const ownership = (brief.companies ?? [])
    .map((co) => ({
      key: co.companyImo ? `imo:${co.companyImo}` : `name:${co.name.toLowerCase()}`,
      name: co.name,
      role: co.role,
      imo: co.companyImo,
      sanctioned: co.sanctioned || (co.category != null && co.category !== "other"),
    }))
    .sort((a, b) => a.key.localeCompare(b.key))

  const inferredOwnership = (brief.inferredOwnership?.entities ?? [])
    .map((e) => ({ key: e.name.toLowerCase(), name: e.name, role: e.role, strength: e.strength }))
    .sort((a, b) => a.key.localeCompare(b.key))

  const ais = brief.ais
    ? {
        darkGaps: brief.ais.darkGapCount,
        stsCandidates: brief.ais.stsCandidateCount,
        speedAnomalies: brief.ais.speedAnomalyCount,
        highRiskZone: brief.ais.highRiskZoneActivity,
      }
    : null

  const inspections = brief.inspections
    ? { detentions: brief.inspections.detentions, deficiencies: brief.inspections.deficiencies }
    : null

  const sisters = brief.fleet?.sisters ?? []
  const fleetHits = {
    direct: sisters.filter((s) => s.sanctioned || s.category === "sanctioned").length,
    linked: sisters.filter((s) => !s.sanctioned && s.category === "sanction_linked").length,
  }

  return {
    verdict: brief.verdict ? { decision: brief.verdict.decision, score: brief.verdict.score } : null,
    sanctions,
    ownership,
    inferredOwnership,
    ais,
    inspections,
    fleetHits,
    flag: brief.identity?.flag ?? null,
  }
}

// ---- canonical JSON + isomorphic fingerprint --------------------------------
/** Stable JSON: object keys sorted recursively so key order never affects a hash. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null)
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(",")}}`
}

/** cyrb53 — a compact, well-distributed 53-bit non-cryptographic hash. Change
 * detection needs a stable fingerprint, not collision resistance; this keeps the
 * module dependency-free and identical in Node and the browser. */
function cyrb53(str: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  const n = 4294967296 * (2097151 & h2) + (h1 >>> 0)
  return n.toString(16).padStart(14, "0")
}

export interface SnapshotHashes {
  /** Fingerprint of the whole snapshot. */
  overall: string
  /** Per-facet fingerprint — lets a monitor cheaply see which facet moved. */
  byFacet: Record<WatchFacet, string>
}

/** Fingerprint a snapshot overall and per-facet. */
export function hashSnapshot(snap: WatchSnapshot): SnapshotHashes {
  const byFacet = {
    verdict: cyrb53(canonical(snap.verdict)),
    sanctions: cyrb53(canonical(snap.sanctions)),
    ownership: cyrb53(canonical(snap.ownership)),
    inferredOwnership: cyrb53(canonical(snap.inferredOwnership)),
    ais: cyrb53(canonical(snap.ais)),
    inspections: cyrb53(canonical(snap.inspections)),
    fleet: cyrb53(canonical(snap.fleetHits)),
    flag: cyrb53(canonical(snap.flag)),
  } satisfies Record<WatchFacet, string>
  return { overall: cyrb53(canonical(snap)), byFacet }
}

// ---- diffing ---------------------------------------------------------------
const verdictRank = (d: VesselVerdict): number => VESSEL_VERDICTS.indexOf(d)

function diffSet<T extends { key: string }>(
  facet: WatchFacet,
  prev: T[],
  next: T[],
  describe: (item: T) => string,
  escalates: (item: T) => boolean,
): WatchChange[] {
  const prevKeys = new Set(prev.map((i) => i.key))
  const nextKeys = new Set(next.map((i) => i.key))
  const out: WatchChange[] = []
  for (const item of next) {
    if (!prevKeys.has(item.key)) {
      out.push({ facet, kind: "added", label: `New ${describe(item)}`, before: null, after: describe(item), escalation: escalates(item) })
    }
  }
  for (const item of prev) {
    if (!nextKeys.has(item.key)) {
      out.push({ facet, kind: "removed", label: `Cleared ${describe(item)}`, before: describe(item), after: null, escalation: false })
    }
  }
  return out
}

const describeSanction = (s: { entity: string; list: string; category: string | null }): string =>
  `sanctions match: ${s.list}${s.category && s.category !== "other" ? ` (${s.category})` : ""} — ${s.entity}`
const describeOwner = (o: { name: string; role: string }): string => `${o.role}: ${o.name}`
const describeInferred = (i: { name: string; strength: string }): string => `inferred owner (${i.strength}): ${i.name}`

/**
 * Diff two snapshots into a facet-scoped, human list of changes.
 *
 * `checks` restricts which facets are compared — a "sanctions only" monitor never
 * reports an ownership change it didn't re-fetch. `verdict` is ALWAYS compared (it
 * is the headline). Facets a run couldn't refresh (stage unavailable → carried
 * forward as an identical value) naturally diff to nothing, so a transient outage
 * never masquerades as a removal.
 */
export function diffSnapshots(
  prev: WatchSnapshot,
  next: WatchSnapshot,
  facets: WatchFacet[] = [...WATCH_FACETS],
): WatchChange[] {
  const on = new Set<WatchFacet>([...facets, "verdict"])
  const changes: WatchChange[] = []

  if (on.has("verdict") && prev.verdict && next.verdict) {
    const before = `${prev.verdict.decision} (${prev.verdict.score})`
    const after = `${next.verdict.decision} (${next.verdict.score})`
    if (before !== after) {
      const worse =
        verdictRank(next.verdict.decision) > verdictRank(prev.verdict.decision) || next.verdict.score > prev.verdict.score
      changes.push({ facet: "verdict", kind: "changed", label: `Verdict ${before} → ${after}`, before, after, escalation: worse })
    }
  }

  if (on.has("sanctions")) {
    changes.push(
      ...diffSet("sanctions", prev.sanctions, next.sanctions, describeSanction, (s) => s.category === "sanctioned" || s.tier === "hit"),
    )
  }
  if (on.has("ownership")) {
    changes.push(...diffSet("ownership", prev.ownership, next.ownership, describeOwner, (o) => o.sanctioned))
  }
  if (on.has("inferredOwnership")) {
    changes.push(
      ...diffSet("inferredOwnership", prev.inferredOwnership, next.inferredOwnership, describeInferred, (i) => i.strength === "strong"),
    )
  }
  if (on.has("flag") && prev.flag !== next.flag) {
    changes.push({ facet: "flag", kind: "changed", label: `Flag ${prev.flag ?? "—"} → ${next.flag ?? "—"}`, before: prev.flag, after: next.flag, escalation: false })
  }
  if (on.has("fleet") && (prev.fleetHits.direct !== next.fleetHits.direct || prev.fleetHits.linked !== next.fleetHits.linked)) {
    const before = `${prev.fleetHits.direct} direct / ${prev.fleetHits.linked} linked`
    const after = `${next.fleetHits.direct} direct / ${next.fleetHits.linked} linked`
    changes.push({ facet: "fleet", kind: "changed", label: `Sanctioned sisters ${before} → ${after}`, before, after, escalation: next.fleetHits.direct > prev.fleetHits.direct })
  }
  if (on.has("inspections") && prev.inspections && next.inspections) {
    if (prev.inspections.detentions !== next.inspections.detentions) {
      changes.push({
        facet: "inspections",
        kind: "changed",
        label: `Detentions ${prev.inspections.detentions} → ${next.inspections.detentions}`,
        before: String(prev.inspections.detentions),
        after: String(next.inspections.detentions),
        escalation: next.inspections.detentions > prev.inspections.detentions,
      })
    }
  }
  if (on.has("ais") && prev.ais && next.ais) {
    const fields: [keyof NonNullable<WatchSnapshot["ais"]>, string][] = [
      ["darkGaps", "dark gaps"],
      ["stsCandidates", "STS candidates"],
      ["speedAnomalies", "speed anomalies"],
    ]
    for (const [f, label] of fields) {
      if (prev.ais[f] !== next.ais[f]) {
        changes.push({
          facet: "ais",
          kind: "changed",
          label: `AIS ${label} ${prev.ais[f]} → ${next.ais[f]}`,
          before: String(prev.ais[f]),
          after: String(next.ais[f]),
          escalation: Number(next.ais[f]) > Number(prev.ais[f]),
        })
      }
    }
    if (prev.ais.highRiskZone !== next.ais.highRiskZone) {
      changes.push({
        facet: "ais",
        kind: "changed",
        label: next.ais.highRiskZone ? "Entered high-risk STS zone activity" : "No longer active in high-risk STS zone",
        before: String(prev.ais.highRiskZone),
        after: String(next.ais.highRiskZone),
        escalation: next.ais.highRiskZone,
      })
    }
  }

  return changes
}

/** Whether a detected change set warrants a notification under the monitor's mode. */
export function shouldNotify(changes: WatchChange[], mode: "all_changes" | "escalations_only"): boolean {
  if (changes.length === 0) return false
  return mode === "all_changes" ? true : changes.some((c) => c.escalation)
}
