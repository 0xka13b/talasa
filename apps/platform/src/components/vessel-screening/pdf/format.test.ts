import { describe, it, expect } from "vitest"
import type { VesselBrief } from "@talasa/shared"
import {
  formatReportDate,
  pdfFileName,
  orDash,
  verdictLabel,
  severityLabel,
} from "./format"

function brief(overrides: Partial<VesselBrief>): VesselBrief {
  return {
    imo: "9123456",
    generatedAt: "2026-06-29T10:00:00.000Z",
    ...overrides,
  } as VesselBrief
}

describe("formatReportDate", () => {
  it("formats an ISO timestamp as 'D Mon YYYY'", () => {
    expect(formatReportDate("2026-06-29T10:00:00.000Z")).toBe("29 Jun 2026")
  })
  it("returns an em dash for missing or unparseable input", () => {
    expect(formatReportDate(null)).toBe("—")
    expect(formatReportDate("not-a-date")).toBe("—")
  })
})

describe("pdfFileName", () => {
  it("builds 'screening-<imo>-<date>.pdf' from a numeric IMO", () => {
    expect(pdfFileName(brief({}))).toBe("screening-9123456-2026-06-29.pdf")
  })
  it("falls back to safe tokens for non-numeric imo / bad date", () => {
    expect(pdfFileName(brief({ imo: "../etc", generatedAt: "nope" }))).toBe(
      "screening-vessel-report.pdf"
    )
  })
})

describe("orDash", () => {
  it("passes through non-empty values and dashes empties", () => {
    expect(orDash("Acme")).toBe("Acme")
    expect(orDash(0)).toBe("0")
    expect(orDash("  ")).toBe("—")
    expect(orDash(null)).toBe("—")
    expect(orDash(undefined)).toBe("—")
  })
})

describe("labels", () => {
  it("maps verdict decisions and signal severities to readable labels", () => {
    expect(verdictLabel("BLOCK")).toBe("Block")
    expect(severityLabel("blocking")).toBe("Blocking")
    expect(severityLabel("weak")).toBe("Low")
  })
})
