# Vessel screening

A vessel screening takes an IMO number and produces a risk report. The report
covers identity, history, port state control record, ownership, sister fleet,
sanctions exposure, AIS behaviour, a deterministic verdict (PROCEED / CAUTION /
BLOCK) and an LLM-written narrative.

## Starting a screening

The input is a 7-digit IMO number and an optional display name. Only the
format is checked; the IMO check digit is not. There are three ways to start a
screening:

- **Single:** the platform calls `POST /api/screenings`, then
  `POST /api/screenings/:id/run`, which sets the row to `queued`.
- **Batch:** uploading a spreadsheet creates up to 5 queued screenings at once.
  See [monitoring-and-batches.md](monitoring-and-batches.md).
- **Monitor:** a monitor enqueues re-screens on a schedule, and those re-run
  only the stages its checks select.

The worker claims queued rows and runs the stages below in order. The UI polls
until the screening is `completed` or `failed`.

## Pipeline

Each stage's result is written to the screening's `steps` column as soon as it
finishes. A stage is retried up to three times.

- **Critical** stages fail the whole screening if they fail.
- **Best-effort** stages record a data gap and the run continues.

| # | Stage | Source | What it does | If it fails |
|---|---|---|---|---|
| 1 | `identify` | Equasis ship page | Particulars (flag, type, tonnage, build year, class, MMSI), detention rate, Paris/Tokyo MoU status, owner/manager companies, geographic sightings | **Screening fails** |
| 2 | `history` | Equasis ship history | Past flags and names, with change counts | Gap |
| 3 | `inspections` | Equasis inspections | Port state control inspections, detentions, deficiencies; flags inspections in suspect countries | Gap |
| 4 | `fleet` | Equasis fleet listings | Sister vessels under each owner/manager, fetching full ship pages up to the caps below | Gap |
| 5 | `enrich` | GLEIF | LEI records and direct/ultimate parents for the owner/manager companies (exact name matches only) | Gap |
| 6 | `sanctions` | OpenSanctions (yente) | Screens the vessel, its fleet, its companies and their parents | Gap, and the verdict is at least CAUTION |
| 7 | `ownership` | LLM | Only when registered ownership is undisclosed: a hypothesis of who may be behind it | Recorded as done with no inference |
| 8 | `ais` | Datalastic | 90-day AIS history analysed for gaps, loitering and speed anomalies | Gap (also when no key is set) |
| 9 | `synthesize` | Deterministic code + LLM | Builds the evidence and verdict, then asks the LLM for the narrative; adds place labels | **Screening fails** |

### Timing

Equasis is scraped at one request every 30 seconds by default (see
[data-sources.md](data-sources.md)). A screening makes three requests plus one
per company plus one per sister vessel page fetched. So a vessel with a large
sister fleet can take 30 minutes or more.

The sister crawl is bounded by `VESSEL_MAX_SISTERS_PER_COMPANY` (default 25)
and `VESSEL_MAX_SISTER_PAGES` (default 60). These cap only the full ship-page
fetches. Every sister in the listing is still screened by IMO.

### Sanctions

The `sanctions` stage sends these queries to OpenSanctions `/match/default`, 25
per batch:

1. **The vessel:** IMO (bare and as `IMO1234567`), name and flag.
2. **Sister vessels:** each by IMO.
3. **Management companies:** by name. If GLEIF found a different legal name,
   that is screened too.
4. **GLEIF parents:** by name and jurisdiction.

Matching uses the `logic-v2` algorithm with a 0.7 threshold, and returns up to
5 candidates per query. Each match is classified as one of:
- **directly sanctioned:** `sanction`, `export.control`
- **sanction-linked:** `sanction.linked`
- **PEP:** `role.pep`, `role.rca`
- **POI:** `poi`

The report then shows an overall sanctions status:
- **CONFIRMED:** the vessel or a management company is directly designated.
- **POSSIBLE:** any link, sister, parent or POI signal.
- **NO_MATCH:** otherwise.

How these feed the verdict is in [scoring.md](scoring.md).

### Ownership inference

When Equasis shows the registered owner as undisclosed and sanctions data holds
a narrative about the vessel, the LLM proposes likely controlling entities.
Each gets a role and a strength (strong / moderate / weak). This is
labelled as a hypothesis in the report and never replaces the registry
companies.

### Synthesis

1. **Evidence.** The worker assembles all stage outputs into one evidence
   object and computes the verdict and signals (see [scoring.md](scoring.md)).
2. **Narrative.** The LLM receives the evidence, verdict included, and fills
   exactly four fields:
   - executive summary
   - sanctions narrative
   - predictive assessment
   - recommendation

   Its prompt forbids changing or questioning the verdict, inventing
   designations or owners, and naming data providers.
3. **Merge.** The worker copies the decision, score and drivers back from the
   evidence, so the LLM output cannot change them.
4. **Place labels.** Each AIS event gets an offline label (nearest port, sea
   area and an approximate EEZ) and, with a Google Maps key, a reverse-geocoded
   place name.

## The report

The report page has six tabs:

| Tab | Contents |
|---|---|
| Overview | Verdict and score, risk signals, sanctions status and matches, executive summary, predictive assessment, data gaps |
| Vessel | Particulars, PSC inspections and detentions, ship history, geographic sightings |
| Ownership | Registry companies with GLEIF data and parents, inferred ownership network |
| Sister fleet | Sister vessels and their sanctions status |
| AIS behaviour | Event list, event map, transmission timeline, on-demand satellite check ([ais-and-satellite.md](ais-and-satellite.md)) |
| Graph | Interactive entity graph of vessel, companies, parents and sisters. Layout, notes and connectors are saved per screening |

**Export PDF** creates the report in the browser (`@react-pdf/renderer`). It
contains the recommendation, summary, sanctions, predictive assessment, risk
signals, particulars, PSC, history, ownership, sister fleet, AIS events (with a
static map when a Google Maps key is set), relationships and data completeness.

**Data completeness** lists which sources answered and which are gaps. The
beneficial owner is always listed as a gap, because Talasa has no beneficial
ownership source.

## Known limitations

- **No beneficial ownership data.** GLEIF parents (exact name match only) and
  the LLM hypothesis are the only ownership signals beyond the registry.
- **First page only:** only the first page of an Equasis fleet listing is read.
- **LLM required:** without an LLM endpoint every data stage runs, then the
  screening fails at `synthesize`.
- **Retries cost:** each retry of the `ais` stage spends Datalastic credits
  again.
- **Multiple workers:** leases have no heartbeat. If you run more than one
  worker process, set `WORKER_LEASE_MINUTES` above your longest screening
  (see [architecture.md](architecture.md)).

## Code map

| Path | What |
|---|---|
| `apps/jobs/src/pipeline/vessel/pipeline.ts` | Stage orchestration |
| `apps/jobs/src/pipeline/vessel/*.ts` | One file per stage, plus `evidence.ts` and `graph.ts` |
| `apps/jobs/src/pipeline/vessel/maritime/` | Offline port / sea / EEZ labelling data |
| `packages/shared/src/vessel.ts` | Stage names, brief schema |
| `packages/inference/src/vessel-prompt.ts` | LLM rubric for the narrative |
| `apps/platform/src/components/vessel-screening/` | Report UI and PDF |
