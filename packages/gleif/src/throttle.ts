/**
 * Serializes async calls and enforces a minimum gap between the start of
 * consecutive calls. The first call runs immediately. Used to stay under
 * GLEIF's 60 req/min limit without per-call coordination at call sites.
 */
export class Throttle {
  private queue: Promise<unknown> = Promise.resolve()
  // -Infinity so the first call's computed wait is negative (no delay).
  private lastStartAt = Number.NEGATIVE_INFINITY

  constructor(private readonly minIntervalMs: number) {}

  run<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.queue.then(async () => {
      const wait = this.minIntervalMs - (Date.now() - this.lastStartAt)
      if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait))
      }
      this.lastStartAt = Date.now()
      return fn()
    })
    // Keep the chain alive even if a task rejects, so later calls still run.
    this.queue = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }
}
