# @talasa/gdelt

Typed client for GDELT's **free** [DOC 2.0](https://www.gdeltproject.org/data.html#documentation)
article API — adverse-media screening for the Counterparty DD flow. Given a
counterparty name it full-text-searches global news and returns matching
articles, biased toward the harshest coverage. Relevance/adverseness is a
downstream (LLM) judgement — nothing is asserted here (results are
*suspected / unverified*).

> **Status:** not wired into any pipeline yet. The Counterparty DD flow has no
> news stage today; this client is ready for one.

No API key, no auth, no jobs. This package is just the client + types.

> **Why the free API?** The hosted GDELT *Cloud* API returns LLM-clustered
> stories/events but is paywalled and expensive. The public DOC API is free and
> gives the raw article feed; the enrichment (clustering, tone, event coding)
> becomes our own downstream LLM step rather than a paid upstream.

## Usage

```ts
import { GdeltClient } from "@talasa/gdelt"

const client = new GdeltClient() // no key required

// Adverse-media scan for one counterparty (last 3 months, harshest first):
const coverage = await client.screenEntity("HAI KUO SHIPPING 1984B LTD")
// coverage.query    -> the exact GDELT query issued
// coverage.articles -> Article[]  (url, title, domain, language, sourceCountry, seenDate, imageUrl)

// Narrow to strongly-negative, English-language coverage:
await client.screenEntity("Sovcomflot", { maxTone: -5, sourceLang: "english", timespan: "1w" })

// Or run a raw GDELT query directly:
await client.searchArticles({
  query: '"ACME SHIPPING" (detained OR sanctioned) tone<-3',
  sort: "toneAsc",
  maxRecords: 50,
})
```

## Endpoint & rate limits

Hits `GET https://api.gdeltproject.org/api/v2/doc/doc` (`mode=ArtList&format=json`).

The public endpoint asks for **≤ 1 request every ~5 seconds**. When you exceed
that — or send a malformed query — GDELT replies with a *plain-text* notice,
**often at HTTP 200**. The client detects this and throws `GdeltRateLimitError`
or `GdeltQueryError` accordingly, so a throttle never silently parses as
"0 results". Space calls out (e.g. one counterparty per job tick).

## Query grammar

`searchArticles` takes a raw GDELT query; `screenEntity` builds one for you
(exact-phrase name + optional filters). Useful operators:

| Operator | Meaning |
|---|---|
| `"two words"` | exact phrase (always quote multi-word names) |
| `tone<-5` / `tone>5` | average article tone below/above N (negative = adverse) |
| `sourcelang:english` | restrict by language |
| `sourcecountry:russia` | restrict by source country |
| `domain:reuters.com` | restrict to one outlet |
| `a OR b` | disjunction |

## Window

Defaults to a trailing **`timespan: "3m"`**. Pass a different `timespan`
(`24h`, `1w`, `6m`, …) or an explicit `startDate`/`endDate` (`Date` or a
`YYYYMMDDHHMMSS` string) for a fixed range — explicit dates override `timespan`.

## Config

| Option | Default | Notes |
|---|---|---|
| `baseUrl` | `https://api.gdeltproject.org` | override for a proxy/mirror |
