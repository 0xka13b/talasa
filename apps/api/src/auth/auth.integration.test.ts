import { describe, expect, it } from "vitest"
import { createApp } from "../app"

const app = createApp()

describe("auth", () => {
  it("registers then returns a session for the new user", async () => {
    const signUp = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Cap", email: "cap@example.com", password: "password123" }),
    })
    expect(signUp.status).toBe(200)
    const cookie = signUp.headers.get("set-cookie") ?? ""
    expect(cookie).toContain("better-auth")

    const me = await app.request("/api/auth/get-session", { headers: { cookie } })
    expect(me.status).toBe(200)
    const body = await me.json() as { user?: { email?: string } }
    expect(body?.user?.email).toBe("cap@example.com")
  })
})
