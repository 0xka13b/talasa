# @talasa/shared

The contracts and deterministic logic every workspace must agree on — Zod schemas
for the API↔frontend wire shapes, the domain vocabularies (sanction categories,
verdicts, stage names), and the pure functions that turn evidence into a score.
Consumed by `apps/api`, `apps/jobs`, `apps/platform`, `packages/db` and `packages/inference`.

**The rule:** something belongs here only if two or more workspaces must agree on it
*and* it is pure. Schemas, enums, scoring maths, detectors — yes. Anything that does
I/O belongs in a client package (`@talasa/equasis`, `@talasa/opensanctions`,
`@talasa/copernicus`); anything that renders belongs in the app. The only runtime
dependency is `zod`, and that is load-bearing: it keeps this package importable from
a Next.js client component, a worker, and a Drizzle schema alike.

> **Why is `formatSanctionCategory` not in here?** It *is* the canonical formatter,
> but it lives in `apps/platform/src/components/vessel-screening/vessel-labels.ts`
> alongside `isDirectSanction` — labels and colours are presentation, and only one
> app renders them. Shared owns the *vocabulary*; the app owns its *rendering*. Push
> a formatter down here only when a second consumer needs it.

No build step: `exports` points at `./src/index.ts`, so consumers compile the TS
directly; everything is re-exported from the one barrel.

## Usage

```ts
import {
  computeVesselVerdict, isHighRiskFlag, analyzeTrack, aisScoreInputs,
  buildWatchSnapshot, diffSnapshots, shouldNotify, facetsForChecks,
  evaluateSuspectVisit, type VesselBrief,
} from "@talasa/shared"

// Deterministic AIS detectors over a Datalastic track — no I/O, no LLM.
const behaviour = analyzeTrack(fixes) // -> darkGaps, loiters, speedAnomalies

// The verdict. A *direct* designation short-circuits to BLOCK/100 before any
// points are summed; everything else is weighted (VESSEL_SCORE_WEIGHTS).
const verdict = computeVesselVerdict({
  subjectSanction: "linked",      // "direct" | "linked" | null
  managementSanction: null,
  parentSanction: null,
  directSisterCount: 0, linkedSisterCount: 2,
  riskyFlag: isHighRiskFlag(identity.flag),
  highDetention: false, mouBlackOrGrey: false,
  subjectReviewMatch: false,
  subjectPoi: true,               // topic `poi` — 45 pts, not a designation
  sanctionsUnavailable: false,    // true => never PROCEED (gap floor)
  ...aisScoreInputs(behaviour),
})
// -> { decision: "BLOCK" | "CAUTION" | "PROCEED", score, drivers: ["sanctions.subject_poi", …] }

// Monitoring: project a brief to its watch snapshot, then diff two runs.
const changes = diffSnapshots(buildWatchSnapshot(prev), buildWatchSnapshot(next), facetsForChecks(["sanctions"]))
if (shouldNotify(changes, "escalations_only")) notify(changes)

// Suspect-country visit (Russia only on/after 2022; Iran always).
evaluateSuspectVisit("Novorossiysk, Russia", "01/03/2023") // -> { label: "Russia", flagged: true }
```

## Module map

| Module | Domain |
|---|---|
| `dd.ts` | Counterparty-DD contracts (`briefSchema`, `DDEvidence`, stages) **plus the two cross-cutting vocabularies**: `SANCTION_CATEGORIES` and the `EntityGraph` node/edge schema shared by vessel screening *and* DD. |
| `vessel.ts` | Vessel screening: `vesselBriefSchema`, identity/history/inspections/AIS sub-schemas, `VesselEvidence`, `graphBoardSchema` (the user's graph overlay — positions and notes only, never entity data). |
| `vessel-scoring.ts` | `computeVesselVerdict`, `VESSEL_SCORE_WEIGHTS`, `SanctionSeverity`, `isHighRiskFlag`. The auditable model. |
| `scoring.ts` | The *DD* score — `computeRiskScore` / `decideAction` over `CLEAR`/`ENHANCED_DD`/`REJECT`. Separate ladder from the vessel verdict; don't conflate them. |
| `ais.ts` | Pure track detectors: dark gaps, loiters/STS candidates, speed anomalies, `HIGH_RISK_STS_ZONES`, `haversineNm`. |
| `watch-snapshot.ts` | Change detection: `buildWatchSnapshot` → `hashSnapshot` / `diffSnapshots`. Isomorphic (cyrb53, no `node:crypto`) so the browser renders the diff the worker computed. |
| `monitor.ts` | Recurring-monitor rules: cadences, checks, and the `CHECK_STAGES` / `CHECK_FACETS` maps resolving a check to what re-runs and what is compared. |
| `batch.ts` | `parseBatchGrid` — a client-parsed CSV/XLSX grid → deduped `{ imo, name }` plus an honest account of every dropped row. `MAX_BATCH_VESSELS = 5`. |
| `project.ts` · `chat.ts` | Project status/intake schemas; chat + message wire shapes. |
| `suspect-countries.ts` | The suspect-country registry (`sinceYear` thresholds) behind port-call, sighting, and flag-change flags. |

> **Why is change detection a snapshot, not a brief hash?** A brief carries LLM
> prose, timestamps, token counts, and jittering AIS positions — hashing it flips
> on every run and says nothing. The snapshot projects out only the watched facts,
> sorted stably, so a hash change means a *fact* changed.

## Sanction categories — the one vocabulary

`sanctionCategory` (`dd.ts`) is the **single** canonical label vocabulary:
`sanctioned` · `sanction_linked` · `pep` · `poi` · `other`. It is derived from
OpenSanctions FtM topics by `classifyCategory` in `@talasa/opensanctions`, and
mirrored here so briefs, the entity graph, and the watch snapshot all speak it.
Format it with `formatSanctionCategory`; test severity with `isDirectSanction`
(both in `vessel-labels.ts`, see above) — never by hand-comparing strings.

A parallel `MatchStatus` system was deliberately removed. **Do not reintroduce it.**
Two vocabularies means two places to get "sanctioned" vs "merely linked" wrong, and
that distinction is the crux of the model: a direct designation is a legal
prohibition (hard BLOCK), a link is a weighted signal.

> **POI is not a sanction.** Topic `poi` — an OpenSanctions *entity of interest*,
> e.g. a shadow-fleet tanker — carries no designation, and its narrative lives in
> the FtM `description` field (surfaced as `VesselSanctionMatch.description`), not
> in the topic tags. Keep it: the pipeline's filter is `category !== "other"`, which
> retains PEP and POI matches on purpose. `subjectPoi` scores 45 points — strong
> evidence, never a BLOCK on its own.
