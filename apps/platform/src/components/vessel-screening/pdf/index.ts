/**
 * Lazy entry point for the screening PDF export. The screening report reaches
 * this module only via `await import("./pdf")` on an explicit user action, so the
 * whole `@react-pdf/renderer` runtime stays out of the main bundle until needed.
 */
import { createElement } from "react"
import { pdf } from "@react-pdf/renderer"
import type { VesselBrief } from "@talasa/shared"
import { VesselBriefDocument } from "./vessel-document"
import { pdfFileName } from "./format"

/** Render the brief to a PDF Blob. Pure-ish: no DOM side effects. */
export async function buildBriefPdfBlob(
  brief: VesselBrief,
  graph: unknown
): Promise<Blob> {
  // `pdf()` is typed to want a <Document> element specifically; our wrapper
  // component renders one, so cast to the parameter type to bridge it.
  const element = createElement(VesselBriefDocument, {
    brief,
    graph,
  }) as Parameters<typeof pdf>[0]
  return pdf(element).toBlob()
}

/**
 * Build the report PDF and trigger a browser download. Resolves once the download
 * has been initiated; throws if rendering fails so the caller can surface an error.
 */
export async function exportBriefPdf(
  brief: VesselBrief,
  graph: unknown
): Promise<void> {
  const blob = await buildBriefPdfBlob(brief, graph)
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement("a")
    a.href = url
    a.download = pdfFileName(brief)
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    // Revoke on the next tick so the click has a chance to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}
