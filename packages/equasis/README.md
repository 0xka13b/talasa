# @talasa/equasis

Typed **scraper** for **Equasis** — the IMO-backed public ship registry — the
primary source of vessel identity, ownership chains and PSC inspection history
for the vessel screening and Counterparty DD flows. It logs in as a real user,
POSTs the site's form endpoints, and parses the returned HTML (cheerio) into
zod-validated types. There is **no API**: every method is a page scrape of a
login-gated web app that can and does change shape without notice.

> ## ⚠️ Read this before you touch the throttle
>
> **This account has already been flagged and cancelled once for aggressive
> scraping.** Equasis polices scraping and will kill the account, not rate-limit
> it — there is no 429 to back off from, only a dead login.
>
> The safe value is **one request per 30 seconds** —
> `EQUASIS_MIN_REQUEST_INTERVAL_MS=30000`. **Do not lower it.** Not to speed up a
> job, not "just for this run", not to make a test finish. A large sister-fleet
> crawl takes **~30 minutes** at this rate; that is the expected cost, not a bug
> to optimise away. If a crawl outlives its worker lease, raise
> `WORKER_LEASE_MINUTES` (`.env.example` sets `45`) — never lower the interval.

## Usage

```ts
import { EquasisClient } from "@talasa/equasis"

const equasis = new EquasisClient({
  email: process.env.EQUASIS_EMAIL!,
  password: process.env.EQUASIS_PASSWORD!,
  minRequestIntervalMs: 30_000, // see the warning above — never pass a lower value
})

// Vessel by IMO — the workhorse. One page yields identity + ownership + sightings.
const ship = await equasis.getShipByImo("9298595")
// ship.particulars -> imo, name, flag, callSign, mmsi, grossTonnage, deadweight, shipType, yearOfBuild, status
// ship.overview    -> classedByIacs, detentionRate, parisMou, tokyoMou, usCoastGuard
// ship.management  -> ManagementEntry[] (companyImo, role, name, address, dateOfEffect) — the ownership chain
// ship.geography   -> GeographyEntry[]  (date, area, source) — coarse zone sightings, not AIS

// Port-state-control record — detentions are the hardest signal Equasis carries.
const { inspections } = await equasis.getShipInspections("9298595")
// inspections -> Inspection[] (authority, date, port, detained, deficiencies)

// Name / flag / owner churn — rapid changes are a classic dark-fleet tell.
const { entries } = await equasis.getShipHistory("9298595")
// entries -> HistoryEntry[] (kind, value, from, to) — `to` is always null; Equasis records start dates only

// Company side: resolve a name to an Equasis company number, then enumerate its fleet.
const hits = await equasis.searchCompaniesByName("HAI KUO SHIPPING") // -> CompanyResult[] (id, name, address)
const fleet = await equasis.getCompanyFleet(hits[0]!.id)
// fleet -> { companyImo, name, vessels: FleetVesselRef[] (imo, name, flag, type) }

await equasis.searchCompaniesById("1234567") // when you already hold the company number
```

## Session & auth

Credentials, not a key. Login is two steps: GET a public page to be issued a
`JSESSIONID`, then POST `j_email`/`j_password` to upgrade **that same session** in
place (Equasis does not rotate the id on login). The cookie is cached for the
client's lifetime; every response is sniffed for the login form, and a mid-use
expiry triggers exactly one re-login + retry before `SessionExpiredError`. Share
one client per process — `apps/api` and `apps/jobs` each build a lazy singleton,
so one session and one throttle cover everything.

## Config

| Option | Default | Notes |
|---|---|---|
| `email` / `password` | — | required; `EQUASIS_EMAIL` / `EQUASIS_PASSWORD` |
| `baseUrl` | `https://www.equasis.org/EquasisWeb` | |
| `userAgent` | a desktop Chrome UA | **don't send a bot UA** — Equasis serves different, unparseable markup |
| `minRequestIntervalMs` | `1000` | **the package default is unsafe on its own.** Both apps override it from `EQUASIS_MIN_REQUEST_INTERVAL_MS` (env default `30000`). Always pass it explicitly |

## Notes

- **Requests are serialized**, not just spaced: every call queues on one internal
  promise chain, so parallel `Promise.all` fan-out in a pipeline still emits one
  request per interval. Concurrency buys you nothing here — budget in wall-clock.
- Errors are typed off `EquasisError`: `EquasisHttpError` (non-2xx),
  `SessionExpiredError`, `NotFoundError` (page loaded, ship absent), `ParseError`
  (page loaded, shape changed → zod rejected it). A `ParseError` spike means the
  markup moved; fixtures in `test/fixtures/*.html` pin the parsers — reproduce
  there first. Messages are deliberately **vendor-agnostic** ("Vessel Data
  Source …") because they can surface to users on a failed screening.
- Scrape artefacts are real: `stripFalseFlag` exists because an adjacent boolean
  cell bleeds into the flag text ("Malta False" → "Malta").
