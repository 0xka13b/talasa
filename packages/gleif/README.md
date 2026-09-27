# @talasa/gleif

Typed client over the **Global LEI Index** — GLEIF's open JSON:API — for
legal-entity and ownership resolution. It turns a company *name* (all Equasis
ever gives us) into a verified legal entity plus its direct and ultimate
consolidating parents: the legal-entity spine of the Counterparty DD network,
and the `enrich` stage of the vessel pipeline.

No key, no auth, no jobs. This package is just the client + types.

## Usage

```ts
import { GleifClient } from "@talasa/gleif"

const client = new GleifClient() // no credentials — GLEIF is a public API

// The main entry point: name -> verified entity + ownership chain.
const profile = await client.lookupCompany("Maersk A/S", { includeOwnership: true })
// profile.match          -> { value, confidence: "exact" | "fuzzy" }
// profile.company        -> GleifCompany (lei, legalName, otherNames, jurisdiction,
//                           entityStatus, registrationStatus, legalForm, category,
//                           registeredAs/At, address, headquartersAddress, bic)
// profile.directParent   -> GleifOwnershipLink | null  (IS_DIRECTLY_CONSOLIDATED_BY)
// profile.ultimateParent -> GleifOwnershipLink | null  (IS_ULTIMATELY_CONSOLIDATED_BY)
// -> null when the name matches no LEI record at all.

// Lower-level pieces, if you already hold an LEI:
await client.searchByName("HAI KUO SHIPPING 1984B LTD", { limit: 5 }) // -> GleifNameMatch[]
await client.getRecord("254900BLYIXBFFRLUJ90") // -> GleifCompany | null
await client.getDirectParent("254900BLYIXBFFRLUJ90") // -> GleifCompany | null
await client.getUltimateParent("254900BLYIXBFFRLUJ90") // -> GleifCompany | null
```

## Auth & rate limits

Free and keyless — `https://api.gleif.org/api/v1` needs no token. The cap is
**60 req/min**, and `lookupCompany` spends ~3 of them per company (search →
record → both parents), so a fleet of management companies burns through the
budget fast. Requests are therefore serialized through an internal `Throttle`
with a minimum gap between call *starts*; a 429 still surfaces as
`GleifRateLimitError`.

## Config

| Option | Default | Notes |
|---|---|---|
| `baseUrl` | `https://api.gleif.org/api/v1` | env `GLEIF_BASE_URL` in `apps/jobs` |
| `timeoutMs` | `15000` | per request; overrun throws `GleifTimeoutError` |
| `minRequestIntervalMs` | `1000` | min gap between requests; env `GLEIF_MIN_REQUEST_INTERVAL_MS` |

`searchByName` caps candidates at `DEFAULT_FUZZY_LIMIT` (`5`); the underlying
`page[size]` is clamped to 1–100.

> **Why `/lei-records?filter[entity.legalName]=` and not `/fuzzycompletions`?**
> Because **`/fuzzycompletions` is dead.** GLEIF's autocomplete endpoint now
> returns `{"data":[]}` for ordinary company names — even "Maersk" — so name
> resolution through it silently yields *no ownership data at all*, in both the
> DD ownership stage and vessel enrichment. `fuzzyByName` uses the `lei-records`
> legal-name filter (a contains-match returning full records) and adapts the
> results into the legacy `FuzzyMatch` shape so the mapper stays unchanged.
> `fuzzyResponseSchema` / `FuzzyMatch` survive only as that internal shape —
> their names are vestigial. **Do not switch this back.** If GLEIF ownership ever
> comes back empty, check this endpoint first.

## Notes

- **Matching is a contains-match, so it lies confidently.** `searchByName`
  promotes an exactly-normalized legal-name hit to the front, and
  `matchConfidence` labels the result `exact` or `fuzzy` (`normalizeName`:
  lowercase, strip diacritics/punctuation, collapse whitespace). Vessel
  enrichment **discards anything not `exact`** — a fuzzy parent chain attributed
  to the wrong company is worse than no data. DD's `resolveOwnership` keeps
  fuzzy matches but passes `matchConfidence` through for downstream judgement.
- **"No record" is not an error.** A 404 maps to `null`, and GLEIF may answer
  "no parent reported" with **200 + a `reporting-exceptions` envelope** rather
  than a 404 — any non-`lei-records` payload is also treated as `null`. So a
  missing parent is indistinguishable from an unreported one; both mean "GLEIF
  doesn't know", never "no parent exists".
- `includeOwnership` defaults to **on** (only an explicit `false` skips the two
  parent calls) — pass it when you only need verification, to save 2/3 of the
  request budget.
- Errors are typed off a `GleifError` base: `GleifConfigError`, `GleifHttpError`
  (`.status`, `.body`), `GleifRateLimitError` (429), `GleifTimeoutError`.
