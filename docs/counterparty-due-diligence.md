# Counterparty due diligence

Counterparty due diligence (DD) screens a shipping **company**, for example a
prospective charterer, owner or manager. It maps the company's fleet and
corporate network, checks the network against sanctions lists, and returns a
verdict: **CLEAR**, **ENHANCED_DD** or **REJECT**. The API and database call a
DD case a *project*.

## Starting a case

1. Type a company name and press **Search**. The search runs only on that
   click, because Equasis is rate-limited. It queries the Equasis company
   register through `GET /api/equasis/company?name=`.
2. Pick the matching company. Its Equasis company number and address are
   stored with the case.
3. If there is no match, choose **Screen … without a registry match** to run on
   the typed name alone.

The platform then creates the project and calls `POST /api/projects/:id/run`.
The worker picks it up from the queue, and the page polls its progress.

## Pipeline

There are five stages:
- `resolve` and `synthesize` are critical: if they fail, the case fails.
- The rest are best-effort: a failure becomes a data gap and the run
  continues.

| # | Stage | Source | What it does |
|---|---|---|---|
| 1 | `resolve` | Equasis, OpenSanctions, LLM | Settles which legal entity is meant (see below) |
| 2 | `network` | Equasis | Maps the company's fleet and the companies it shares vessels with |
| 3 | `ownership` | GLEIF | LEI record plus direct and ultimate parents |
| 4 | `sanctions` | OpenSanctions (yente) | Screens the company, its linked companies, its parents and up to 25 vessels |
| 5 | `synthesize` | Deterministic code + LLM | Builds evidence, score, verdict and graph, then the narrative |

### 1. Resolve

- **Registry pick (the normal path):** when the user picked an Equasis company,
  the stage trusts that pick with no extra calls. It uses confidence 0.9.
- **Name only:** it searches Equasis and OpenSanctions in parallel and scores
  the candidates.
  - An exact name match scores higher than a partial one.
  - A matching sanctions entity adds to the score.
  - If candidates tie, a small LLM call (`DD_RESOLVER_MODEL`) picks one.
  - If nothing matches, the run continues on the typed name with confidence
    0.1.

### 2. Network

1. Read the company's Equasis fleet listing.
2. For the first **15** vessels, read each ship page and inspection record.
   - Every other owner or manager on those vessels becomes a *linked company*,
     with its roles and the vessels it shares.
   - Every detention in the inspection record is collected.
3. The top **8** linked companies, ranked by shared vessels, get their own
   fleet listing, and up to 8 of their vessels are sampled.

This stage makes up to about 40 Equasis requests, so at the default 30-second
throttle it can take around 20 minutes.

### 3. Ownership

GLEIF is searched by legal name. The best hit's LEI record and its direct and
ultimate parents are attached. Each result is marked `exact` or `fuzzy` in the
report. A fuzzy match can be the wrong entity, so check it.

### 4. Sanctions

**What is screened:**
- **Companies:** the subject company, every linked company and the GLEIF
  parents, in one batched call.
- **Vessels:** up to **25** IMOs, the subject's fleet first, then affiliates'
  fleets.

Matching uses the same settings as vessel screening: `logic-v2` with a 0.7
threshold. Each match is classified as directly sanctioned, sanction-linked,
PEP or POI, and colours its node in the graph.

**Sanctions status:**

| Status | When |
|---|---|
| CONFIRMED | A fleet vessel matched **by IMO** is directly designated |
| POSSIBLE | Any other sanctions-topic match, including name-based company matches |
| NO_MATCH | Nothing with a sanctions topic |

If the stage fails (for example yente is down), the status falls back to
NO_MATCH and a `sanctions` data gap is recorded.

### 5. Synthesize

1. **Evidence.** Deterministic code assembles the evidence, computes the score
   and verdict (see [scoring.md](scoring.md)) and builds the entity graph.
2. **Narrative.** The LLM receives the evidence, without the graph, and writes
   six fields:
   - executive summary
   - affiliations narrative
   - ownership narrative
   - sanctions narrative
   - risk justification
   - recommended-action rationale

   It is told to ground every sentence in the evidence, to distinguish sanctioned
   from sanction-linked, and not to name data providers.
3. **Merge.** The score and decision are taken from the evidence, not from the
   LLM.

## Entity graph

The graph uses the same schema and the same interactive board as vessel
screening.

**Nodes:**
- the subject company
- its fleet vessels
- linked companies and their sampled vessels
- GLEIF parents

**Edges:** they run from company to vessel with a role (`registered_owner`,
`ism_manager`, `commercial_manager`, `manager`), plus `parent` and
`ultimate_parent` from the subject to its GLEIF parents.

**Node colours:** red for directly sanctioned, amber for linked, PEP or POI.

## The report

| Tab | Contents |
|---|---|
| Overview | Score and verdict, drivers and risk justification, sanctions status and matches, sanctions narrative, executive summary, data gaps |
| Fleet | Searchable fleet list (owner/manager for the sampled vessels), detentions, a "Screen vessel" link that starts a vessel screening |
| Network | Linked companies sorted by risk, with their roles, shared vessels and fleet sample |
| Ownership | GLEIF legal entity, LEI, jurisdiction, parents, ownership narrative |
| Graph | The entity graph and the affiliations narrative |

There is no PDF export for DD reports.

## Known limitations

- **No news stage.** Adverse media is only available through the Ask Agent's
  web search. The `@talasa/gdelt` client exists but is not wired in.
- **Sampling:** the network covers 15 vessels and 8 affiliates, and only the
  first page of each Equasis fleet listing is read.
- **Intake fields:** country and role are not collected by the intake form, so
  jurisdiction-based disambiguation doesn't happen.
- **Graph board:** edits (layout, notes) are not saved for DD reports; they
  are for vessel screenings.
- **Wrong-entity risk:** without a registry pick, the fallbacks take the top
  search result, which can be the wrong company.

## Code map

| Path | What |
|---|---|
| `apps/jobs/src/pipeline/run.ts` | Stage orchestration |
| `apps/jobs/src/pipeline/{resolve,network,ownership,sanctions,synthesize,graph}.ts` | The stages |
| `packages/shared/src/dd.ts`, `scoring.ts` | Brief schema, stage names, scoring |
| `packages/inference/src/prompt.ts` | LLM rubric |
| `apps/platform/src/components/counterparty-dd/` | Intake form and report UI |
