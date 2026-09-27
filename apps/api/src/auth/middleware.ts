import type { MiddlewareHandler } from "hono"
import { auth } from "./index"

export type AuthUser = typeof auth.$Infer.Session.user

export const requireAuth: MiddlewareHandler<{ Variables: { user: AuthUser } }> = async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: "Unauthorized" }, 401)
  c.set("user", session.user)
  await next()
}
