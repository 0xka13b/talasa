import { describe, it, expect, vi } from "vitest"
import { fetchVesselHistory, summariseHistory } from "./history"
import type { HistoryEntry } from "@talasa/equasis"

function entry(over: Partial<HistoryEntry>): HistoryEntry {
  return { kind: "flag", value: null, from: null, to: null, ...over }
}

describe("summariseHistory", () => {
  it("derives distinct flag/name sequences and change counts", () => {
    const h = summariseHistory([
      entry({ kind: "name", value: "CHRISTINA B.", from: "01/03/2012" }),
      entry({ kind: "name", value: "OLD NAME", from: "01/01/2005" }),
      entry({ kind: "flag", value: "Gabon", from: "23/02/2023" }),
      entry({ kind: "flag", value: "Liberia", from: "01/01/2015" }),
      entry({ kind: "flag", value: "Panama", from: "01/01/2010" }),
      entry({ kind: "class", value: "Nippon Kaiji Kyokai (IACS)", from: "19/10/2025" }),
      entry({ kind: "Registered owner", value: "SAMAR MARITIME CO LTD", from: "23/02/2023" }),
    ])
    expect(h.flags).toEqual(["Gabon", "Liberia", "Panama"])
    expect(h.names).toEqual(["CHRISTINA B.", "OLD NAME"])
    expect(h.flagChanges).toBe(2)
    expect(h.nameChanges).toBe(1)
    // every row is kept, and the always-null `to` is dropped
    expect(h.entries).toHaveLength(7)
    expect(h.entries[0]).toEqual({ kind: "name", value: "CHRISTINA B.", from: "01/03/2012" })
  })

  it("de-duplicates repeated flag values and floors change counts at 0", () => {
    const h = summariseHistory([
      entry({ kind: "flag", value: "Panama" }),
      entry({ kind: "flag", value: "Panama" }),
    ])
    expect(h.flags).toEqual(["Panama"])
    expect(h.flagChanges).toBe(0)
    expect(h.nameChanges).toBe(0)
  })

  it("returns empty sequences for a vessel with no history rows", () => {
    const h = summariseHistory([])
    expect(h).toEqual({ flags: [], names: [], flagChanges: 0, nameChanges: 0, entries: [] })
  })
})

describe("fetchVesselHistory", () => {
  it("fetches by IMO and summarises the parsed entries", async () => {
    const getShipHistory = vi.fn(async () => ({
      imo: "9304162",
      entries: [entry({ kind: "flag", value: "Gabon" }), entry({ kind: "flag", value: "Liberia" })],
    }))
    const h = await fetchVesselHistory("9304162", { equasis: { getShipHistory } } as never)
    expect(getShipHistory).toHaveBeenCalledWith("9304162")
    expect(h.flags).toEqual(["Gabon", "Liberia"])
    expect(h.flagChanges).toBe(1)
  })
})
