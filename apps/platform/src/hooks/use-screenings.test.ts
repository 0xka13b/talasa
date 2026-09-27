import { describe, it, expect } from "vitest"
import type { Screening } from "@talasa/shared"
import { recentScreenings } from "./use-screenings"

function s(id: string, createdAt: string): Screening {
  return {
    id,
    name: `name-${id}`,
    imo: "9304162",
    status: "draft",
    vesselName: null,
    flag: null,
    identity: null,
    graph: null,
    brief: null,
    steps: {},
    progress: null,
    modelMeta: null,
    error: null,
    archived: false,
    createdBy: "u",
    createdAt,
    updatedAt: createdAt,
  }
}

describe("recentScreenings", () => {
  it("returns the most-recent-first, capped at the limit", () => {
    const list = [
      s("a", "2026-06-01T00:00:00Z"),
      s("b", "2026-06-03T00:00:00Z"),
      s("c", "2026-06-02T00:00:00Z"),
      s("d", "2026-06-06T00:00:00Z"),
      s("e", "2026-06-05T00:00:00Z"),
      s("f", "2026-06-04T00:00:00Z"),
    ]
    const recent = recentScreenings(list)
    expect(recent).toHaveLength(5)
    expect(recent.map((x) => x.id)).toEqual(["d", "e", "f", "b", "c"])
  })

  it("does not mutate the input array", () => {
    const list = [s("a", "2026-06-01T00:00:00Z"), s("b", "2026-06-02T00:00:00Z")]
    recentScreenings(list)
    expect(list.map((x) => x.id)).toEqual(["a", "b"])
  })
})
