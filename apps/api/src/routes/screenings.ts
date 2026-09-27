import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { createScreeningSchema, graphBoardSchema } from "@talasa/shared"
import type { AuthUser } from "../auth/middleware"
import { requireAuth } from "../auth/middleware"
import { archiveScreening, createScreening, deleteScreening, getScreening, listScreenings, runScreening, saveGraphBoard } from "../services/screenings"
import { isCopernicusConfigured } from "../services/copernicus"
import { StsSarInputError, verifyScreeningStsSar } from "../services/sts-sar"

export const screeningsRouter = new Hono<{ Variables: { user: AuthUser } }>()

screeningsRouter.use("*", requireAuth)

screeningsRouter.get("/", async (c) => c.json(await listScreenings(c.get("user").id)))

screeningsRouter.post("/", zValidator("json", createScreeningSchema), async (c) =>
  c.json(await createScreening(c.get("user").id, c.req.valid("json")), 201),
)

screeningsRouter.get("/:id", async (c) => {
  const row = await getScreening(c.get("user").id, c.req.param("id"))
  return row ? c.json(row) : c.json({ error: "Not found" }, 404)
})

screeningsRouter.delete("/:id", async (c) => {
  const ok = await deleteScreening(c.get("user").id, c.req.param("id"))
  return ok ? c.body(null, 204) : c.json({ error: "Not found" }, 404)
})

screeningsRouter.post("/:id/run", async (c) => {
  const row = await runScreening(c.get("user").id, c.req.param("id"))
  return row ? c.json(row) : c.json({ error: "Not found" }, 404)
})

screeningsRouter.post("/:id/archive", async (c) => {
  const row = await archiveScreening(c.get("user").id, c.req.param("id"))
  return row ? c.json(row) : c.json({ error: "Not found" }, 404)
})

screeningsRouter.patch("/:id/graph-board", zValidator("json", graphBoardSchema), async (c) => {
  const row = await saveGraphBoard(c.get("user").id, c.req.param("id"), c.req.valid("json"))
  return row ? c.json(row) : c.json({ error: "Not found" }, 404)
})

/**
 * On-demand Sentinel-1 SAR verification of the Nth AIS event (an STS candidate).
 * PU-metered and user-triggered — NOT run in the pipeline. Returns the graded
 * verdict + a base64 two-pol chip; the UI calls it only when a user expands the
 * event's "Show SAR" panel.
 */
screeningsRouter.post("/:id/sts/:idx/sar", async (c) => {
  if (!isCopernicusConfigured()) {
    return c.json({ error: "Satellite verification is not configured on this server" }, 503)
  }
  const idx = Number(c.req.param("idx"))
  if (!Number.isInteger(idx) || idx < 0) {
    return c.json({ error: "Invalid event index" }, 400)
  }
  const q = c.req.query("palette")
  const palette = q === "twopol" || q === "optical" ? q : "terrain"
  const zoomKm = c.req.query("zoomKm") ? Number(c.req.query("zoomKm")) : undefined
  try {
    const result = await verifyScreeningStsSar(c.get("user").id, c.req.param("id"), idx, { palette, zoomKm })
    return result ? c.json(result) : c.json({ error: "Not found" }, 404)
  } catch (err) {
    if (err instanceof StsSarInputError) return c.json({ error: err.message }, 400)
    console.error("sts-sar route error:", err)
    return c.json({ error: "Satellite verification failed" }, 502)
  }
})
