import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { createMonitorSchema, updateMonitorSchema } from "@talasa/shared"
import type { AuthUser } from "../auth/middleware"
import { requireAuth } from "../auth/middleware"
import {
  listMonitors, createMonitor, getMonitor, updateMonitor, deleteMonitor, archiveMonitor,
  triggerMonitor, listChanges, acknowledgeChange, acknowledgeAll,
} from "../services/monitors"

export const monitorsRouter = new Hono<{ Variables: { user: AuthUser } }>()

monitorsRouter.use("*", requireAuth)

monitorsRouter.get("/", async (c) => c.json(await listMonitors(c.get("user").id)))

monitorsRouter.post("/", zValidator("json", createMonitorSchema), async (c) => {
  const result = await createMonitor(c.get("user").id, c.req.valid("json"))
  return "error" in result ? c.json(result, 400) : c.json(result, 201)
})

// Cross-monitor change feed (for the sidebar badge + feed). `?unacked=1` filters.
monitorsRouter.get("/changes", async (c) => {
  const unacknowledgedOnly = c.req.query("unacked") === "1"
  return c.json(await listChanges(c.get("user").id, { unacknowledgedOnly }))
})

monitorsRouter.post("/changes/:changeId/ack", async (c) => {
  const ok = await acknowledgeChange(c.get("user").id, c.req.param("changeId"))
  return ok ? c.body(null, 204) : c.json({ error: "Not found" }, 404)
})

monitorsRouter.get("/:id", async (c) => {
  const row = await getMonitor(c.get("user").id, c.req.param("id"))
  return row ? c.json(row) : c.json({ error: "Not found" }, 404)
})

monitorsRouter.patch("/:id", zValidator("json", updateMonitorSchema), async (c) => {
  const row = await updateMonitor(c.get("user").id, c.req.param("id"), c.req.valid("json"))
  return row ? c.json(row) : c.json({ error: "Not found" }, 404)
})

monitorsRouter.post("/:id/trigger", async (c) => {
  const ok = await triggerMonitor(c.get("user").id, c.req.param("id"))
  return ok ? c.body(null, 204) : c.json({ error: "Not found" }, 404)
})

monitorsRouter.post("/:id/ack", async (c) => {
  const n = await acknowledgeAll(c.get("user").id, c.req.param("id"))
  return c.json({ acknowledged: n })
})

monitorsRouter.post("/:id/archive", async (c) => {
  const ok = await archiveMonitor(c.get("user").id, c.req.param("id"))
  return ok ? c.body(null, 204) : c.json({ error: "Not found" }, 404)
})

monitorsRouter.delete("/:id", async (c) => {
  const ok = await deleteMonitor(c.get("user").id, c.req.param("id"))
  return ok ? c.body(null, 204) : c.json({ error: "Not found" }, 404)
})
