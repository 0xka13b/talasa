import { describe, expect, it } from "vitest"
import { stripFalseFlag } from "../src/parse/html"

describe("stripFalseFlag", () => {
  it("strips a trailing false/true token Equasis appends to flag values", () => {
    expect(stripFalseFlag("Madagascar false")).toBe("Madagascar")
    expect(stripFalseFlag("Malta False")).toBe("Malta")
    expect(stripFalseFlag("Panama true")).toBe("Panama")
  })

  it("strips a leading false/true token too", () => {
    expect(stripFalseFlag("false Liberia")).toBe("Liberia")
  })

  it("leaves clean flag values untouched", () => {
    expect(stripFalseFlag("Liberia")).toBe("Liberia")
    expect(stripFalseFlag("Marshall Islands")).toBe("Marshall Islands")
  })

  it("does not clip a legitimate word that merely contains the token", () => {
    expect(stripFalseFlag("Falseland")).toBe("Falseland")
  })

  it("returns null for empty / whitespace-only input", () => {
    expect(stripFalseFlag("")).toBeNull()
    expect(stripFalseFlag("   ")).toBeNull()
    expect(stripFalseFlag(null)).toBeNull()
    expect(stripFalseFlag(undefined)).toBeNull()
  })
})
