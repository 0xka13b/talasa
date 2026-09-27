import { parseBatchGrid, type ParsedBatchFile } from "@talasa/shared"

/** 15 MB — comfortably fits a very large registry export while bounding the
 * client-side parse. */
const MAX_FILE_BYTES = 15 * 1024 * 1024
const ACCEPT_EXT = /\.(csv|tsv|xlsx|xls)$/i

export type BatchReadResult =
  | { ok: true; parsed: ParsedBatchFile; fileName: string }
  | { ok: false; error: string }

const ext = (name: string) => name.split(".").pop()?.toLowerCase() ?? ""

/**
 * Read an uploaded CSV/Excel file into a clean, deduped `{ imo, name }[]` via the
 * shared {@link parseBatchGrid}. SheetJS (which reads xlsx/xls AND delimiter-sniffed
 * csv) is dynamically imported so it never lands in the main bundle. Every failure
 * mode returns a plain-language reason so the UI can tell the user WHY it failed.
 */
export async function readBatchFile(file: File): Promise<BatchReadResult> {
  if (!ACCEPT_EXT.test(file.name)) {
    return { ok: false, error: `Unsupported file type “.${ext(file.name)}”. Upload a .csv, .xlsx or .xls file.` }
  }
  if (file.size === 0) return { ok: false, error: "The file is empty (0 bytes)." }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). The limit is 15 MB.` }
  }

  let grid: string[][]
  try {
    const XLSX = await import("xlsx")
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" })
    const sheetName = wb.SheetNames[0]
    const sheet = sheetName ? wb.Sheets[sheetName] : undefined
    if (!sheet) return { ok: false, error: "The workbook has no readable sheet." }
    // header:1 → array-of-arrays; raw:false → cells as displayed strings (so a
    // numeric IMO cell reads "9304162", not 9304162).
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: "", raw: false })
    grid = rows.map((r) => r.map((c) => String(c ?? "")))
  } catch {
    return { ok: false, error: "We couldn't read this file. It may be corrupt, password-protected, or not a valid CSV/Excel file." }
  }

  const parsed = parseBatchGrid(grid)
  if (parsed.error) return { ok: false, error: parsed.error }
  return { ok: true, parsed, fileName: file.name }
}
