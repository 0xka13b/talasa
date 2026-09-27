import { z } from "zod"

/**
 * Batch vessel screening: upload a CSV/Excel list of vessels and screen them as a
 * set. The FILE is read on the client (SheetJS parses xlsx/xls/csv into a 2D grid
 * of cells); this module holds the pure, provider-agnostic logic that turns that
 * grid into a clean, deduped list of `{ imo, name }` plus an honest per-row
 * account of what was dropped and why — so it is unit-testable and reusable on the
 * server for defence-in-depth.
 */

/** Hard ceiling on vessels per batch. The Equasis throttle (~1 req / 30 s) makes
 * anything larger physically unscreenable in reasonable time, so we cap and tell
 * the user rather than silently enqueue tens of thousands of rows. */
export const MAX_BATCH_VESSELS = 5

/** Cap on how many dropped-row samples we keep for the preview (the count is
 * always exact; we only bound the detailed list so a huge file stays cheap). */
const INVALID_SAMPLE_CAP = 100

export interface BatchVesselRow {
  imo: string
  name: string
  /** True when the source row had no usable name and we defaulted to "IMO <n>".
   * The vessel is still screenable; the flag lets the UI highlight it. */
  nameMissing: boolean
}

/** A source row we could NOT turn into a screenable vessel, with its file line so
 * the user can find and fix it. */
export interface BatchRowIssue {
  /** 1-based line number in the source file. */
  line: number
  rawImo: string
  rawName: string
  reason: string
}

/** Outcome of parsing an uploaded grid — the clean list plus a full account of
 * duplicates, missing names, and unreadable rows, so the UI preview is honest. */
export interface ParsedBatchFile {
  /** Valid, deduped vessels in first-seen order (NOT yet capped to MAX_BATCH_VESSELS). */
  vessels: BatchVesselRow[]
  /** Header we matched the IMO column on, or null when detected positionally. */
  imoHeader: string | null
  /** Header we matched the name column on, or null when absent/positional. */
  nameHeader: string | null
  /** Whether an IMO column could be identified at all (by header or by content). */
  imoColumnFound: boolean
  /** Data rows scanned (excludes the header row and blank lines). */
  scannedRows: number
  /** Rows collapsed because their IMO had already been seen. */
  duplicateCount: number
  /** Vessels whose name was blank in the source and defaulted to "IMO <n>". */
  nameMissingCount: number
  /** Total rows dropped for lacking a valid 7-digit IMO. */
  invalidCount: number
  /** First {@link INVALID_SAMPLE_CAP} dropped rows, for the preview. */
  invalidSamples: BatchRowIssue[]
  /** Set when the file yields nothing screenable, explaining exactly why. */
  error: string | null
}

// ---- API contract (client → server) ----------------------------------------
export const batchVesselSchema = z.object({
  imo: z.string().regex(/^\d{7}$/, "IMO must be 7 digits"),
  name: z.string().trim().min(1).max(200),
})
export type BatchVesselInput = z.infer<typeof batchVesselSchema>

export const createBatchSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  vessels: z.array(batchVesselSchema).min(1, "At least one vessel is required").max(MAX_BATCH_VESSELS),
})
export type CreateBatchInput = z.infer<typeof createBatchSchema>

// ---- read shape (API → frontend) -------------------------------------------
/** Member-screening counts by status, for a batch's aggregate progress bar. */
export const batchStatusCountsSchema = z.object({
  total: z.number(),
  queued: z.number(),
  running: z.number(),
  completed: z.number(),
  failed: z.number(),
})
export type BatchStatusCounts = z.infer<typeof batchStatusCountsSchema>

export const batchSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  counts: batchStatusCountsSchema,
  /** Soft-archived: hidden from the active list; members retained. */
  archived: z.boolean().optional().default(false),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type BatchSummary = z.infer<typeof batchSummarySchema>

// ---- pure parsing helpers ---------------------------------------------------

const norm = (h: unknown): string => String(h ?? "").trim().toLowerCase()
const isBlankRow = (row: string[]): boolean => !row.some((c) => String(c ?? "").trim() !== "")

/**
 * Normalise a cell to a bare 7-digit IMO, or null. Tolerant of an "IMO" prefix,
 * surrounding whitespace, dash separators, and an Excel numeric ".0" tail — but
 * strict on the result being exactly seven digits (so an MMSI or a mangled value
 * is rejected rather than truncated).
 */
export function normalizeImo(cell: unknown): string | null {
  const digits = String(cell ?? "")
    .trim()
    .replace(/^imo[:\s]*/i, "")
    .replace(/\.0+$/, "")
    .replace(/[\s-]/g, "")
  return /^\d{7}$/.test(digits) ? digits : null
}

/** Clean a vessel name: strip a trailing "(dd/mm/yy)"-style parenthetical (survey
 * dates in some registry exports), collapse whitespace, and bound the length. */
export function cleanVesselName(cell: unknown): string {
  return String(cell ?? "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200)
}

/**
 * Locate the IMO column by header. An exact "imo" wins; otherwise any header
 * CONTAINING "imo" (so "Vessel IMO", "Ship IMO", "IMO Number", "IMO No." all
 * match). Returns -1 when no header looks like an IMO column.
 */
export function findImoColumn(headers: string[]): number {
  const hs = headers.map(norm)
  const exact = hs.findIndex((h) => /^imo(\s*(no\.?|number|#|code))?$/.test(h))
  if (exact !== -1) return exact
  return hs.findIndex((h) => /\bimo\b|imo(no|number|#)/.test(h))
}

/**
 * Locate the name column by header, preferring an explicit "ship/vessel name"
 * over a bare "name", and never re-using the IMO column.
 */
export function findNameColumn(headers: string[], imoIdx: number): number {
  const hs = headers.map(norm)
  const preferred = hs.findIndex((h, i) => i !== imoIdx && /(ship|vessel)\s*name/.test(h))
  if (preferred !== -1) return preferred
  return hs.findIndex((h, i) => i !== imoIdx && /name/.test(h))
}

/** Content fallback when there is no recognisable header row: the IMO column is
 * the one with the most 7-digit-IMO-looking cells across the whole grid. */
function detectImoColumnByContent(rows: string[][]): number {
  const width = rows.reduce((w, r) => Math.max(w, r.length), 0)
  let best = -1
  let bestHits = 0
  for (let c = 0; c < width; c++) {
    let hits = 0
    for (const r of rows) if (normalizeImo(r[c]) !== null) hits++
    if (hits > bestHits) {
      bestHits = hits
      best = c
    }
  }
  return bestHits > 0 ? best : -1
}

/** Content fallback for the name column: the non-IMO column with the most
 * non-empty, non-numeric cells. */
function detectNameColumnByContent(rows: string[][], imoIdx: number): number {
  const width = rows.reduce((w, r) => Math.max(w, r.length), 0)
  let best = -1
  let bestHits = 0
  for (let c = 0; c < width; c++) {
    if (c === imoIdx) continue
    let hits = 0
    for (const r of rows) {
      const v = String(r[c] ?? "").trim()
      if (v && !/^\d+$/.test(v)) hits++
    }
    if (hits > bestHits) {
      bestHits = hits
      best = c
    }
  }
  return best
}

/**
 * Turn a raw parsed grid (first non-blank row usually headers) into a clean,
 * deduped list of `{ imo, name }`, plus a full account of what was dropped.
 * Robust to delimiter/column order (columns are matched by name), duplicate IMOs
 * (collapsed, first name wins), missing names (defaulted + flagged), blank lines,
 * and header-less files (falls back to detecting the IMO column by content).
 * Line numbers in {@link BatchRowIssue} are 1-based into the ORIGINAL grid.
 */
export function parseBatchGrid(rows: string[][]): ParsedBatchFile {
  const empty: ParsedBatchFile = {
    vessels: [], imoHeader: null, nameHeader: null, imoColumnFound: false,
    scannedRows: 0, duplicateCount: 0, nameMissingCount: 0, invalidCount: 0, invalidSamples: [], error: null,
  }

  const headerRowIdx = rows.findIndex((r) => !isBlankRow(r))
  if (headerRowIdx === -1) {
    return { ...empty, error: "The file is empty — no rows to read." }
  }

  const headers = (rows[headerRowIdx] ?? []).map((h) => String(h ?? ""))
  let imoIdx = findImoColumn(headers)
  let nameIdx = imoIdx === -1 ? -1 : findNameColumn(headers, imoIdx)
  let dataStart: number
  let imoHeader: string | null
  let nameHeader: string | null

  if (imoIdx === -1) {
    // No IMO header — treat every row from here as data and find the column by content.
    const body = rows.slice(headerRowIdx)
    imoIdx = detectImoColumnByContent(body)
    nameIdx = imoIdx === -1 ? -1 : detectNameColumnByContent(body, imoIdx)
    dataStart = headerRowIdx
    imoHeader = null
    nameHeader = null
  } else {
    dataStart = headerRowIdx + 1
    imoHeader = headers[imoIdx] ?? null
    nameHeader = nameIdx === -1 ? null : (headers[nameIdx] ?? null)
  }

  const imoColumnFound = imoIdx !== -1
  const seen = new Set<string>()
  const vessels: BatchVesselRow[] = []
  const invalidSamples: BatchRowIssue[] = []
  let scannedRows = 0
  let duplicateCount = 0
  let nameMissingCount = 0
  let invalidCount = 0

  for (let j = dataStart; j < rows.length; j++) {
    const row = rows[j] ?? []
    if (isBlankRow(row)) continue
    scannedRows++
    const rawImo = imoIdx === -1 ? "" : String(row[imoIdx] ?? "").trim()
    const rawName = nameIdx === -1 ? "" : String(row[nameIdx] ?? "").trim()
    const imo = imoColumnFound ? normalizeImo(rawImo) : null
    if (!imo) {
      invalidCount++
      if (invalidSamples.length < INVALID_SAMPLE_CAP) {
        invalidSamples.push({ line: j + 1, rawImo, rawName, reason: rawImo ? "Not a valid 7-digit IMO" : "No IMO value" })
      }
      continue
    }
    if (seen.has(imo)) {
      duplicateCount++
      continue
    }
    seen.add(imo)
    const name = cleanVesselName(rawName)
    const nameMissing = name === ""
    if (nameMissing) nameMissingCount++
    vessels.push({ imo, name: name || `IMO ${imo}`, nameMissing })
  }

  const error =
    vessels.length > 0
      ? null
      : !imoColumnFound
        ? "No IMO column found. Expected a column named “IMO” (or “Vessel IMO” / “Ship IMO”), or a column of 7-digit IMO numbers."
        : `No valid IMOs found in ${scannedRows} row${scannedRows === 1 ? "" : "s"}. IMOs must be 7 digits.`

  return { vessels, imoHeader, nameHeader, imoColumnFound, scannedRows, duplicateCount, nameMissingCount, invalidCount, invalidSamples, error }
}
