// Runtime: register jest-dom matchers against vitest's expect. (The
// `@testing-library/jest-dom/vitest` auto-extend stopped registering after a
// dependency reshuffle, so we extend explicitly.) The matching TYPE
// augmentation lives in vitest.d.ts.
import * as matchers from "@testing-library/jest-dom/matchers"
import { cleanup } from "@testing-library/react"
import { afterEach, expect } from "vitest"

expect.extend(matchers)

afterEach(() => {
  cleanup()
})

// jsdom doesn't implement ResizeObserver; components that measure their own
// layout (overflow-aware tab/nav lists) only need the constructor to exist.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ResizeObserverStub
}
