import { describe, expect, it } from "vitest"
import { createApp } from "../app"

const app = createApp()

async function registerAndGetCookie() {
  const res = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Cap", email: "cap@example.com", password: "password123" }),
  })
  return res.headers.get("set-cookie") ?? ""
}

describe("projects routes", () => {
  it("401s without a session", async () => {
    const res = await app.request("/api/projects")
    expect(res.status).toBe(401)
  })

  it("creates and lists projects for the authed user", async () => {
    const cookie = await registerAndGetCookie()
    const create = await app.request("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "DD — MV Example", vesselName: "MV Example", counterpartyName: "Acme Ltd" }),
    })
    expect(create.status).toBe(201)
    const list = await app.request("/api/projects", { headers: { cookie } })
    expect((await list.json())).toHaveLength(1)
  })
})
