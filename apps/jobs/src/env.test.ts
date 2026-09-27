import { describe, expect, it } from "vitest"
import { env } from "./env"
it("provides worker defaults", () => { expect(env.WORKER_POLL_MS).toBeGreaterThan(0) })
