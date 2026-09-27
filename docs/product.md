# Product overview

Talasa helps risk and compliance teams decide whether it is safe to deal with a
vessel or a shipping company. It gathers registry, ownership, sanctions,
inspection and AIS data, turns it into a deterministic verdict, and asks an LLM
to explain the evidence in plain language.

It is meant for people who screen before money moves:
- trade finance and compliance desks at banks
- marine insurers and P&I clubs
- commodity traders
- charterers and brokers

## What you can do

**Screen a vessel.** Enter an IMO number and get a report with:
- a PROCEED / CAUTION / BLOCK verdict and a 0–100 score
- registry data and history
- port state control record
- owners and managers with their corporate parents
- sister fleet
- sanctions matches across the vessel, its fleet and its companies
- AIS behaviour flags
- an interactive entity graph

Export it as a PDF. See [vessel-screening.md](vessel-screening.md).

**Screen a company.** Search the company register, pick the company and get a
CLEAR / ENHANCED_DD / REJECT verdict. The report covers:
- its fleet
- the companies it shares vessels with
- corporate parents
- sanctions exposure across that network
- detentions

See [counterparty-due-diligence.md](counterparty-due-diligence.md).

**Screen a list.** Upload a CSV or Excel file of IMO numbers to screen up to
five vessels at once. See [monitoring-and-batches.md](monitoring-and-batches.md).

**Watch vessels over time.** Set a monitor on a vessel or a batch. It
re-screens on a daily, weekly, biweekly or monthly schedule and records changes,
flagging escalations such as new sanctions matches or a worse verdict.

**Check a suspected ship-to-ship transfer from space.** For a suspected STS
transfer in a vessel report, request a Sentinel-1 radar image of the location
and time. Talasa looks for a second hull alongside. See
[ais-and-satellite.md](ais-and-satellite.md).

**Ask questions.** Every finished report has an Ask Agent chat that answers
from the report's own data and can search the web for recent news, citing
sources. See [ask-agent.md](ask-agent.md).

## How decisions are made

- **Verdicts are rules, not model output.** The score comes from published
  weights, so every verdict can be traced to its drivers. See
  [scoring.md](scoring.md).
- **The LLM explains.** It writes the summary and narrative around a verdict it
  cannot change.
- **Gaps are visible.** If a source is unavailable, the report says so in its
  data-completeness section instead of silently treating missing data as clean.
- **Suspected, not proven.** AIS and ownership-inference signals are presented
  as suspected patterns, never as findings.

Talasa is a decision-support tool. Its output is not legal or compliance advice,
and matches must be reviewed by a person before acting on them.

## Feature status

| Area | Status |
|---|---|
| Vessel screening, scoring, PDF export | Built |
| Counterparty due diligence | Built (no PDF export) |
| Batch screening | Built, 5 vessels per batch |
| Monitoring with change detection | Built; changes are shown in the app only, no email or webhooks |
| AIS behaviour detection | Built for a single vessel; no port-call detection, no fleet-wide scanning |
| Sentinel satellite verification | Built, on demand |
| Ask Agent chat | Built |
| Adverse media / news in reports | Not built (web search through Ask Agent only) |
| Beneficial ownership (UBO) data | Not built; GLEIF parents and LLM inference only |
| Port intelligence, fixture market | Placeholder pages only |
| Teams, roles, sharing | Not built; every record belongs to one user |
| Settings page | Placeholder; profile changes are not saved |

## Glossary

| Term | Meaning |
|---|---|
| **IMO number** | A ship's permanent 7-digit identifier; it doesn't change with name or flag |
| **Flag** | The country a ship is registered in |
| **Equasis** | A public ship-safety database with registry, management and inspection data |
| **PSC** | Port state control: inspections of foreign ships in port. A **detention** means serious deficiencies |
| **Paris / Tokyo MoU** | Regional PSC regimes. They publish white / grey / black lists of flags by performance |
| **ISM manager** | The company responsible for a ship's safety management |
| **Sister vessels** | Other ships with the same owner or manager |
| **LEI** | Legal Entity Identifier, from GLEIF; links companies to their parents |
| **Directly sanctioned** | The entity is itself on a sanctions or export-control list |
| **Sanction-linked** | Related to a sanctioned entity, but not listed itself |
| **PEP** | Politically exposed person |
| **POI** | Person or entity of interest: public scrutiny, no designation |
| **AIS** | Automatic Identification System: the position signal ships broadcast |
| **Dark gap** | A period with no AIS signal |
| **STS transfer** | Ship-to-ship transfer of cargo at sea, a common way to disguise a cargo's origin |
| **SAR** | Synthetic aperture radar: satellite radar imagery that works through cloud and at night |
