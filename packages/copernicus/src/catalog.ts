import type { TokenManager } from "./auth"
import { CATALOG_SEARCH_PATH } from "./constants"
import { authedPost } from "./http"
import type { TransportConfig } from "./http"
import { stacSearchResponseSchema } from "./types"
import type { CatalogQuery, CatalogScene, RawStacItem } from "./types"

function toScene(item: RawStacItem): CatalogScene {
  return {
    id: item.id,
    collection: item.collection ?? null,
    datetime: item.properties?.datetime ?? null,
    bbox: item.bbox ?? null,
    cloudCover: item.properties?.["eo:cloud_cover"] ?? null,
  }
}

/**
 * STAC `POST /search` — list scenes available over an AOI + time window. This is
 * FREE (no processing units), so it's the right pre-check before a Process call:
 * confirm imagery exists (and, for optical, inspect cloud cover) before paying.
 * Returns the first page, newest-first.
 */
export async function searchCatalog(
  transport: TransportConfig,
  tokens: TokenManager,
  query: CatalogQuery,
): Promise<CatalogScene[]> {
  const body = {
    collections: [query.collection],
    // STAC bbox defaults to WGS84 lon/lat, which is what our BBox is in.
    bbox: query.bbox,
    datetime: `${query.time.from}/${query.time.to}`,
    limit: query.limit ?? 50,
  }
  const res = await authedPost(transport, tokens, CATALOG_SEARCH_PATH, {
    body: JSON.stringify(body),
    // STAC search returns a GeoJSON FeatureCollection; accept both so content
    // negotiation doesn't 406.
    accept: "application/json, application/geo+json",
    contentType: "application/json",
  })
  const parsed = stacSearchResponseSchema.parse(await res.json())
  // Newest acquisition first (CDSE's catalog rejects a `sortby` body key).
  return parsed.features
    .map(toScene)
    .sort((a, b) => (b.datetime ?? "").localeCompare(a.datetime ?? ""))
}
