# Talasa documentation

| Document | Covers |
|---|---|
| [Product overview](product.md) | What Talasa does, who it is for, feature status, glossary |
| [Architecture](architecture.md) | Processes, the Postgres job queue, data model, API, security notes |
| [Vessel screening](vessel-screening.md) | The 9-stage vessel pipeline and the report |
| [Risk scoring](scoring.md) | The vessel and counterparty scoring models: every weight and threshold |
| [AIS behaviour and satellite verification](ais-and-satellite.md) | AIS detectors, high-risk zones, the Sentinel STS check |
| [Counterparty due diligence](counterparty-due-diligence.md) | The 5-stage company pipeline, entity graph and report |
| [Batches and monitoring](monitoring-and-batches.md) | Spreadsheet batches, scheduled re-screens, change detection |
| [Ask Agent](ask-agent.md) | The report chat assistant and its tools |
| [Data sources](data-sources.md) | Each provider, what it needs, terms of use, rate limits |
| [Configuration](configuration.md) | Every environment variable |

Each package under `packages/` also has a README describing its client or
library.
