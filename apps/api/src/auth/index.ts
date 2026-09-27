import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db, account, session, user, verification } from "@talasa/db"
import { env } from "../env"

// Cookie model: betterAuth defaults to sameSite:"lax" + secure derived from BETTER_AUTH_URL.
// This works for same-site localhost dev (frontend :3001 <-> api :8787).
// For cross-domain or HTTPS production, set advanced.defaultCookieAttributes
// (secure:true + sameSite:"none") and/or crossSubDomainCookies.
// Split CORS_ORIGIN the same way app.ts does — better-auth checks each entry
// exactly, so passing a comma-joined string as one element would silently reject
// every origin when CORS_ORIGIN lists more than one.
const trustedOrigins = [
  ...env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean),
  "http://localhost:*",
  "http://127.0.0.1:*",
]

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  // Configured origin(s) plus any localhost port — keeps auth working when the
  // frontend dev server drifts to another port. better-auth matches `*` wildcards.
  trustedOrigins,
  emailAndPassword: { enabled: true },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
})
