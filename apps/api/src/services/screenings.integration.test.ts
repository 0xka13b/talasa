import { beforeAll, describe, expect, it } from "vitest"
import { db, user } from "@talasa/db"
import { createScreening, deleteScreening, getScreening, listScreenings, runScreening } from "./screenings"

const USER_ID = "user_test_1"

beforeAll(async () => {
  await db
    .insert(user)
    .values({ id: USER_ID, name: "Cap", email: "cap@example.com", emailVerified: true })
    .onConflictDoNothing()
})

describe("screenings service", () => {
  it("creates, fetches, runs, and deletes a screening", async () => {
    const created = await createScreening(USER_ID, { name: "Acme tanker", imo: "9304162" })
    expect(created.name).toBe("Acme tanker")
    expect(created.imo).toBe("9304162")
    expect(created.status).toBe("draft")
    expect(created.createdBy).toBe(USER_ID)

    const fetched = await getScreening(USER_ID, created.id)
    expect(fetched?.id).toBe(created.id)

    const queued = await runScreening(USER_ID, created.id)
    expect(queued?.status).toBe("queued")
    expect(queued?.brief).toBeNull()
    expect(queued?.error).toBeNull()
    expect(queued?.steps).toEqual({})

    const list = await listScreenings(USER_ID)
    expect(list.some((s) => s.id === created.id)).toBe(true)

    expect(await deleteScreening(USER_ID, created.id)).toBe(true)
    expect(await getScreening(USER_ID, created.id)).toBeNull()
  })

  it("scopes screenings to their creator", async () => {
    const created = await createScreening(USER_ID, { name: "Second", imo: "1111111" })
    expect(await getScreening("someone_else", created.id)).toBeNull()
    await deleteScreening(USER_ID, created.id)
  })
})
