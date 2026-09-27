# Risk scoring

Talasa has two scoring models: one for vessel screening and one for
counterparty due diligence. Both are plain deterministic code. The LLM writes
narrative text around the result but cannot change it: after the LLM call, the
pipeline copies the decision, score and drivers back from the deterministic
evidence.

The same evidence always gives the same verdict. Re-running a screening
re-fetches live data, though, so the verdict changes when the data does.

> These weights are a working starting point, not a validated compliance
> policy. Tune them to your own risk appetite before relying on them.

## Vessel screening

Verdicts are **PROCEED**, **CAUTION** and **BLOCK**, with a score from 0 to 100.
The verdict is computed in three steps.

### 1. Hard block

If the vessel itself, or one of its management companies, is **directly
designated**, the verdict is BLOCK with score 100 and no points are added. A
direct designation is an OpenSanctions match with the `sanction` or
`export.control` topic.

Management companies are the Equasis companies whose role is registered owner
or contains "manager" (ISM manager, commercial manager, and so on) and that
have an Equasis company number. They are matched **by name**, so a name match
on a designated company also triggers the hard block. Check the match score and
listed entity in the report's sanctions section before acting on one.

### 2. Weighted points

Otherwise, the points below are summed and capped at 100.

| Driver | Points | When |
|---|---:|---|
| `sanctions.subject_linked` | 50 | The vessel is sanction-linked (`sanction.linked`: related to a sanctioned party but not itself listed) |
| `sanctions.subject_poi` | 45 | The vessel matches a person/entity of interest or PEP list |
| `sanctions.management_linked` | 40 | A management company is sanction-linked |
| `ownership.parent_designated` | 50 | A GLEIF direct or ultimate parent is directly designated |
| `ownership.parent_linked` | 25 | A GLEIF parent is sanction-linked (only if not designated) |
| `fleet.sister_designated` | 35 each, max 60 | Sister vessels (same owner/manager) that are directly designated |
| `fleet.sister_linked` | 15 each, max 30 | Sister vessels that are sanction-linked |
| `psc.suspect_port_call` | 15 | At least one port state control inspection in a suspect country |
| `geo.suspect_area` | 10 | At least one Equasis geographic sighting in a suspect country |
| `sanctions.name_review` | 20 | The vessel's own sanctions result is "review" (name-level match) |
| `psc.detention_rate` | 20 | Equasis detention rate of 10% or more |
| `mou.listed` | 10 | The flag is on the Paris or Tokyo MoU black or grey list |
| `flag.high_risk` | 10 | The current flag is on the high-risk flag list below |
| `ais.dark_gap_high_risk` | 20 | An AIS gap or suspected STS loiter inside a high-risk zone |
| `ais.dark_gap` | 10 | An AIS gap elsewhere (only if the previous row didn't apply) |
| `ais.sts_candidate` | 15 | At least one suspected ship-to-ship transfer loiter |
| `ais.speed_anomaly` | 10 | At least one implied speed above 30 knots |

Notes on the table:

- **Counts:** apart from sister vessels, each driver adds its points once,
  however many events trigger it.
- **Fleet:** sister-vessel points can add up to 90, which is enough for BLOCK
  on its own.
- **Suspect countries:** Russia (from 2022 onwards) and Iran (any date).
- **High-risk flags:** Gabon, Cameroon, Cook Islands, Palau, Comoros, Honduras,
  Djibouti, São Tomé and Príncipe, Tanzania, Zanzibar, Togo, Sierra Leone,
  Guyana, Eswatini. Large flags of convenience (Panama, Liberia, Marshall
  Islands) are deliberately excluded.
- **AIS:** the thresholds and high-risk zones are described in
  [ais-and-satellite.md](ais-and-satellite.md).

### 3. Bands

| Score | Verdict |
|---|---|
| 70–100 | BLOCK |
| 35–69 | CAUTION |
| 0–34 | PROCEED |

**Sanctions unavailable.** If the sanctions stage failed (for example yente was
down), a PROCEED is raised to CAUTION and the `sanctions.unavailable` driver is
added. The score itself is unchanged, so a CAUTION can show a score below 35.

### Signals without points

The report also lists signals that do not affect the score:
- undisclosed registered ownership
- flag changes (two or more)
- name changes (two or more)
- a change to a suspect country's flag, such as the Russian flag since 2022

They are context for the analyst.

### Example

A vessel flagged in Cameroon, with one sanction-linked sister vessel and an AIS
gap inside the Kerch Strait zone, scores 10 + 15 + 20 = 45 and gets **CAUTION**.

### Where to change it

| What | File |
|---|---|
| Weights, high-risk flags, bands | `packages/shared/src/vessel-scoring.ts` |
| AIS thresholds and zones | `packages/shared/src/ais.ts` |
| Suspect countries | `packages/shared/src/suspect-countries.ts` |
| Detention threshold, MoU matching, signal wording | `apps/jobs/src/pipeline/vessel/evidence.ts` |

## Counterparty due diligence

Verdicts are **CLEAR**, **ENHANCED_DD** and **REJECT**, with a score from 0 to
100.

### Sanctions status

The sanctions stage condenses its matches into one status:

- **CONFIRMED:** a vessel in the company's fleet (or an affiliate's fleet),
  screened by IMO, is directly designated.
- **POSSIBLE:** any other sanctions-topic match. That includes name-based matches
  on the company or its linked companies, and sanction-linked vessels.
- **NO_MATCH:** nothing with a sanctions topic.

PEP and POI matches are shown in the report and colour graph nodes, but they do
not change the status or the score.

### Points and bands

| Driver | Points |
|---|---:|
| `sanctions.confirmed` | 60, and the score is at least 70 |
| `sanctions.possible` | 20 |
| `psc.detentions` | 10 per detention across the sampled fleet, max 30 |
| `ownership.beneficial_unresolved` | 5 |

Bands: 70 and above is REJECT, 40–69 is ENHANCED_DD, below 40 is CLEAR. A
CONFIRMED status is always REJECT.

What this means in practice:

- **REJECT:** in practice only when the status is CONFIRMED.
- **ENHANCED_DD:** needs a POSSIBLE status plus at least two detentions.
- **POSSIBLE alone:** a name-based POSSIBLE match with no detentions scores
  20–25, which is **CLEAR**. Always read the sanctions section, not only the
  band.
- **Sanctions stage failed:** the run falls back to NO_MATCH and records a data
  gap. The result can still be CLEAR, so check the data gaps.
- **Beneficial owner:** it counts as "resolved" when GLEIF reports an ultimate
  parent, or an LEI with no parent. That is accounting consolidation data, not
  true beneficial-ownership data.

The model lives in `packages/shared/src/scoring.ts`.
