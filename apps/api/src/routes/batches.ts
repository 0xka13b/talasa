import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { createBatchSchema } from "@talasa/shared"
import type { AuthUser } from "../auth/middleware"
import { requireAuth } from "../auth/middleware"
import { archiveBatch, createBatch, deleteBatch, getBatch, listBatches } from "../services/batches"

export const batchesRouter = new Hono<{ Variables: { user: AuthUser } }>()

batchesRouter.use("*", requireAuth)

batchesRouter.get("/", async (c) => c.json(await listBatches(c.get("user").id)))

batchesRouter.post("/", zValidator("json", createBatchSchema), async (c) =>
  c.json(await createBatch(c.get("user").id, c.req.valid("json")), 201),
)

batchesRouter.get("/:id", async (c) => {
  const row = await getBatch(c.get("user").id, c.req.param("id"))
  return row ? c.json(row) : c.json({ error: "Not found" }, 404)
})

batchesRouter.post("/:id/archive", async (c) => {
  const ok = await archiveBatch(c.get("user").id, c.req.param("id"))
  return ok ? c.body(null, 204) : c.json({ error: "Not found" }, 404)
})

batchesRouter.delete("/:id", async (c) => {
  const ok = await deleteBatch(c.get("user").id, c.req.param("id"))
  return ok ? c.body(null, 204) : c.json({ error: "Not found" }, 404)
})
