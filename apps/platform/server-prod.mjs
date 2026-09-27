// Production server for the built TanStack Start app.
//
// `vite build` emits a WEB fetch handler at dist/server/server.js (no listening
// server) plus static client assets in dist/client. This entry serves the static
// assets and falls through to the SSR handler for everything else, then listens
// on PORT. Run with: node server-prod.mjs  (from the app root, CWD = this dir).
import { serve } from "@hono/node-server"
import { serveStatic } from "@hono/node-server/serve-static"
import { Hono } from "hono"
import handler from "./dist/server/server.js"

const app = new Hono()

// Built client files (hashed /assets/* + favicon, manifest, robots, logo).
// serveStatic calls next() on a miss, so unknown paths fall through to SSR.
app.use("/*", serveStatic({ root: "./dist/client" }))

// Everything else → server-side render.
app.all("/*", (c) => handler.fetch(c.req.raw))

const port = Number(process.env.PORT ?? 3000)
serve({ fetch: app.fetch, port }, () => console.log(`platform listening on :${port}`))
