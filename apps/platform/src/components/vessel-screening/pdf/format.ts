/**
 * Pure formatting helpers for the client-facing PDF export. Kept free of any
 * `@react-pdf/renderer` import so they stay cheap to unit-test and don't drag the
 * (lazily-loaded) PDF runtime into the test bundle.
 */
import type { VesselBrief } from "@talasa/shared"

/** Diagonal watermark stamped on every page — brand + confidentiality marker. */
export const WATERMARK_TEXT = "TALASA · CONFIDENTIAL"

/** Footer notice repeated on every page. */
export const CONFIDENTIAL_NOTICE =
  "Talasa · Confidential — provided for the recipient's own use"

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

/**
 * Format an ISO timestamp as "29 Jun 2026". Returns "—" when the input is missing
 * or unparseable so a sparse brief still yields a valid document.
 */
export function formatReportDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** Download filename, e.g. `screening-9123456-2026-06-29.pdf`. */
export function pdfFileName(brief: VesselBrief): string {
  const imo = /^\d+$/.test(brief.imo) ? brief.imo : "vessel"
  const d = new Date(brief.generatedAt)
  const datePart = Number.isNaN(d.getTime())
    ? "report"
    : d.toISOString().slice(0, 10)
  return `screening-${imo}-${datePart}.pdf`
}

/** A value or an em dash when the value is empty — used everywhere for sparse fields. */
export function orDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  const s = String(value).trim()
  return s.length === 0 ? "—" : s
}

/** Human label for a verdict decision. */
export function verdictLabel(
  decision: VesselBrief["verdict"]["decision"]
): string {
  return { PROCEED: "Proceed", CAUTION: "Caution", BLOCK: "Block" }[decision]
}

/** Human label for a risk-signal severity. */
export function severityLabel(
  severity: "weak" | "strong" | "blocking"
): string {
  return { weak: "Low", strong: "Elevated", blocking: "Blocking" }[severity]
}
