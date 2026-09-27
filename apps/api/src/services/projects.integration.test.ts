import { beforeAll, describe, expect, it } from "vitest"
import { db, user } from "@talasa/db"
import { createProject, deleteProject, getProject, listProjects, runProject, updateProject } from "./projects"

const USER_ID = "user_test_1"

beforeAll(async () => {
  await db
    .insert(user)
    .values({ id: USER_ID, name: "Cap", email: "cap@example.com", emailVerified: true })
    .onConflictDoNothing()
})

const input = { name: "DD — MV Example", vesselName: "MV Example", counterpartyName: "Acme Ltd" }

describe("projects service", () => {
  it("creates a draft project owned by the user", async () => {
    const p = await createProject(USER_ID, input)
    expect(p.status).toBe("draft")
    expect(p.createdBy).toBe(USER_ID)
    expect(await listProjects(USER_ID)).toHaveLength(1)
  })

  it("scopes reads to the owner", async () => {
    const p = await createProject(USER_ID, input)
    expect(await getProject("someone_else", p.id)).toBeNull()
  })

  it("updates fields", async () => {
    const p = await createProject(USER_ID, input)
    const u = await updateProject(USER_ID, p.id, { counterpartyName: "Beta Marine" })
    expect(u?.counterpartyName).toBe("Beta Marine")
  })

  it("runs: resets pipeline columns and sets status to queued", async () => {
    const p = await createProject(USER_ID, input)
    const queued = await runProject(USER_ID, p.id)
    expect(queued?.status).toBe("queued")
    expect(queued?.brief).toBeNull()
    expect(queued?.error).toBeNull()
    expect(queued?.steps).toEqual({})
  })

  it("deletes", async () => {
    const p = await createProject(USER_ID, input)
    expect(await deleteProject(USER_ID, p.id)).toBe(true)
    expect(await getProject(USER_ID, p.id)).toBeNull()
  })
})
