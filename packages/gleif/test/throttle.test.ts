import { afterEach, describe, expect, it, vi } from "vitest"
import { Throttle } from "../src/throttle"

afterEach(() => {
  vi.useRealTimers()
})

describe("Throttle", () => {
  it("runs tasks in submission order and returns their results", async () => {
    const t = new Throttle(0)
    const order: number[] = []
    const make = (n: number) => () => {
      order.push(n)
      return Promise.resolve(n)
    }
    const results = await Promise.all([t.run(make(1)), t.run(make(2)), t.run(make(3))])
    expect(order).toEqual([1, 2, 3])
    expect(results).toEqual([1, 2, 3])
  })

  it("a rejecting task does not wedge the queue", async () => {
    const t = new Throttle(0)
    const ran: number[] = []
    const bad = t.run(async () => {
      ran.push(1)
      throw new Error("boom")
    })
    await expect(bad).rejects.toThrow("boom")
    const good = await t.run(async () => {
      ran.push(2)
      return "ok"
    })
    expect(good).toBe("ok")
    expect(ran).toEqual([1, 2])
  })

  it("does not delay the first call but spaces the second by minIntervalMs", async () => {
    vi.useFakeTimers()
    const t = new Throttle(1000)
    const calls: number[] = []
    const p1 = t.run(async () => {
      calls.push(1)
    })
    const p2 = t.run(async () => {
      calls.push(2)
    })
    await p1
    expect(calls).toEqual([1])
    await vi.advanceTimersByTimeAsync(1000)
    await p2
    expect(calls).toEqual([1, 2])
  })
})
