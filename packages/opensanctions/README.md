# @talasa/opensanctions

Typed client for the [OpenSanctions](https://www.opensanctions.org) matching API
(hosted, or a self-hosted [yente](https://github.com/opensanctions/yente)) — sanctions / watchlist screening for the Counterparty DD flow. It screens a
vessel and its ownership chain (the entities `@talasa/equasis` returns) and maps
the raw FtM match results to a domain decision: **hit / review / clear**.

This package is just the client + types; running yente locally is covered in the
repo-root README.

## Usage

```ts
import { OpenSanctionsClient } from "@talasa/opensanctions"

const client = new OpenSanctionsClient({ apiKey: process.env.OPENSANCTIONS_API_KEY! })

// One batched call for the whole counterparty:
const screening = await client.screenCounterparty({
  vessel: { imo: "9811000", name: "EVER GIVEN" },
  companies: [{ name: "LUSTER MARITIME SA" }, { name: "HIGAKI SANGYO KAISHA" }],
})
// screening.overall -> "hit" | "review" | "clear"
// screening.results -> per-entity decision + matched entities (caption, topics, datasets, score)

// Or screen individually:
await client.screenVessel({ imo: "9811000" })
await client.screenCompany({ name: "ACME SHIPPING LTD" })
await client.getEntity("NK-abc123") // drill down on a match
```

## Decision ladder

Per the data-enrichment plan §2:

- **Tier 1 — strong identifier:** a vessel queried by IMO/MMSI whose match carries a
  sanctions topic → **hit**.
- **Tier 3 — name-based:** a company/person name match with a sanctions topic →
  **review** (never auto-reject on a name).
- Otherwise → **clear**. A `role.pep`-only match is informational, not a hit (only
  `sanction` / `sanction.linked` / `export.control` topics drive a decision).

## Config

| Option | Default | Notes |
|---|---|---|
| `apiKey` | — | required for the hosted API (opensanctions.org/api); blank for a self-hosted yente |
| `baseUrl` | `https://api.opensanctions.org` | e.g. `http://localhost:8000` for local yente |
| `dataset` | `default` | full collection (sanctions + watchlists + PEPs) |
| `algorithm` | `logic-v2` | **pinned** (not `best`) for reproducible, auditable scores |
| `threshold` / `cutoff` | `0.7` | match flag / drop-below |
| `limit` | `5` | candidates per query |

Authenticates via `Authorization: ApiKey <key>`. Provide the key from env
(`OPENSANCTIONS_API_KEY`) when wiring a consumer (API route or job).
