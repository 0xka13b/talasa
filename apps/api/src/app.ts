import { Hono } from "hono"
import { cors } from "hono/cors"
import { env } from "./env"
import { auth } from "./auth"
import { projectsRouter } from "./routes/projects"
import { screeningsRouter } from "./routes/screenings"
import { batchesRouter } from "./routes/batches"
import { monitorsRouter } from "./routes/monitors"
import { equasisRouter } from "./routes/equasis"
import { chatsRouter } from "./routes/chats"

const allowedOrigins = env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean)
const isLocalhost = (origin: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)

/**
 * Reflect the configured origin(s); also allow any localhost port so the
 * frontend dev server can drift (e.g. 3001 → 3003 when a port is taken)
 * without breaking CORS/auth. Non-localhost origins must be in CORS_ORIGIN.
 */
function corsOrigin(origin: string): string | null {
  if (!origin) return allowedOrigins[0] ?? null
  if (allowedOrigins.includes(origin) || isLocalhost(origin)) return origin
  return null
}

export function createApp() {
  const app = new Hono()
  app.use("*", cors({ origin: corsOrigin, credentials: true }))
  app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw))
  app.route("/api/projects", projectsRouter)
  app.route("/api/screenings", screeningsRouter)
  app.route("/api/batches", batchesRouter)
  app.route("/api/monitors", monitorsRouter)
  app.route("/api/equasis", equasisRouter)
  app.route("/api/chats", chatsRouter)
  app.get("/health", (c) => c.json({ ok: true }))
  return app
}
