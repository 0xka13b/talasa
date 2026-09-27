import { describe, expect, it } from "vitest"
import { DEFAULT_BASE_URL, DEFAULT_MIN_REQUEST_INTERVAL_MS } from "../src/constants"
import { GleifError, GleifHttpError, GleifRateLimitError } from "../src/errors"

describe("constants", () => {
  it("base url has no trailing slash and points at v1", () => {
    expect(DEFAULT_BASE_URL).toBe("https://api.gleif.org/api/v1")
    expect(DEFAULT_MIN_REQUEST_INTERVAL_MS).toBe(1000)
  })
})

describe("errors", () => {
  it("rate limit error is an instanceof the base and http error", () => {
    const err = new GleifRateLimitError(429, "slow down")
    expect(err).toBeInstanceOf(GleifError)
    expect(err).toBeInstanceOf(GleifHttpError)
    expect(err.status).toBe(429)
  })
})
