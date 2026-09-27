// Type augmentation for jest-dom matchers on vitest's expect.
// jest-dom 6.x augments `declare module 'vitest'`, but in vitest 4 the real
// `Assertion` returned by `expect()` is declared in `@vitest/expect` (vitest
// only re-exports it), so that augmentation is a no-op. Augment the source
// module directly, mirroring its EXACT type-parameter signature (`T = any`) so
// declaration merging applies. Runtime registration is in vitest.setup.ts.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers"

declare module "@vitest/expect" {
  interface Assertion<T = any> extends TestingLibraryMatchers<any, T> {}
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<any, any> {}
}
