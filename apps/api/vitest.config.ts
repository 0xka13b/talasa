import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    // Integration suites share one Postgres; run test files serially so their
    // per-test TRUNCATE/seed in beforeEach don't race across parallel workers.
    fileParallelism: false,
  },
})
