import { Hono } from "hono"
import type { Context } from "hono"
import { NotFoundError } from "@talasa/equasis"
import type { AuthUser } from "../auth/middleware"
import { requireAuth } from "../auth/middleware"
import { getEquasisClient } from "../services/equasis"

export const equasisRouter = new Hono<{ Variables: { user: AuthUser } }>()

equasisRouter.use("*", requireAuth)

equasisRouter.get("/ship/:imo", async (c) => {
  try {
    return c.json(await getEquasisClient().getShipByImo(c.req.param("imo")))
  } catch (err) {
    return handleEquasisError(c, err)
  }
})

equasisRouter.get("/company", async (c) => {
  const name = c.req.query("name")
  const id = c.req.query("id")
  try {
    const client = getEquasisClient()
    if (name) return c.json(await client.searchCompaniesByName(name))
    if (id) return c.json(await client.searchCompaniesById(id))
    return c.json({ error: "Provide ?name= or ?id=" }, 400)
  } catch (err) {
    return handleEquasisError(c, err)
  }
})

function handleEquasisError(c: Context, err: unknown): Response {
  if (err instanceof NotFoundError) {
    return c.json({ error: err.message }, 404)
  }
  console.error("equasis route error:", err)
  return c.json({ error: "Vessel Data Source lookup failed" }, 502)
}
