import type { TokenManager } from "./auth"
import { PROCESS_PATH, PU_HEADER } from "./constants"
import { authedPost } from "./http"
import type { TransportConfig } from "./http"
import type { ProcessQuery, ProcessResult } from "./types"

/** WGS84 lon/lat — matches the CRS our BBox inputs are expressed in. */
const CRS_WGS84 = "http://www.opengis.net/def/crs/OGC/1.3/CRS84"

/**
 * Process API — render an AOI+time through an evalscript into image bytes.
 *
 * This is PU-metered: cost scales with output `width × height`, band count and
 * the collection. Keep the AOI small and the raster matched to the task (10m/px
 * for Sentinel-1/2). The billed processing units are read back from the
 * response header and returned alongside the bytes for quota tracking.
 */
export async function runProcess(
  transport: TransportConfig,
  tokens: TokenManager,
  query: ProcessQuery,
): Promise<ProcessResult> {
  const format = query.format ?? "image/png"
  const body = {
    input: {
      bounds: {
        bbox: query.bbox,
        properties: { crs: CRS_WGS84 },
      },
      data: [
        {
          type: query.collection,
          dataFilter: { timeRange: { from: query.time.from, to: query.time.to } },
        },
      ],
    },
    output: {
      width: query.width,
      height: query.height,
      responses: [{ identifier: "default", format: { type: format } }],
    },
    evalscript: query.evalscript,
  }

  const res = await authedPost(transport, tokens, PROCESS_PATH, {
    body: JSON.stringify(body),
    accept: format,
    contentType: "application/json",
  })

  const puRaw = res.headers.get(PU_HEADER)
  const processingUnits = puRaw != null && puRaw !== "" ? Number(puRaw) : null
  const buf = new Uint8Array(await res.arrayBuffer())

  return {
    image: buf,
    contentType: res.headers.get("content-type") ?? format,
    processingUnits: Number.isFinite(processingUnits) ? processingUnits : null,
  }
}
