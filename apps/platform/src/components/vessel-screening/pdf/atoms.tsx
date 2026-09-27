/**
 * Reusable react-pdf building blocks for the screening report: the page chrome
 * (watermark + footer), section scaffolding, field grids, tags and tables. All
 * black-on-white, restrained, document-like — colour is used only to flag risk.
 *
 * This module (and everything it pulls from `@react-pdf/renderer`) is only ever
 * reached through the lazily-imported `./index`, so it never lands in the main
 * bundle until the user actually exports a PDF.
 */
import { View, Text, StyleSheet } from "@react-pdf/renderer"
import { WATERMARK_TEXT, CONFIDENTIAL_NOTICE } from "./format"

// ---- palette ----------------------------------------------------------------
export const COLOR = {
  ink: "#111827", // near-black body text
  muted: "#6b7280", // labels, secondary text
  faint: "#9ca3af", // footer, captions
  line: "#d1d5db", // hairline rules
  lineSoft: "#e5e7eb",
  danger: "#b91c1c", // sanctioned / block
  warn: "#b45309", // caution / elevated
  ok: "#15803d", // proceed
} as const

export const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    lineHeight: 1.5,
    color: COLOR.ink,
    backgroundColor: "#ffffff",
  },

  // page chrome
  watermark: {
    position: "absolute",
    top: "45%",
    left: 0,
    right: 0,
    textAlign: "center",
    fontFamily: "Helvetica-Bold",
    fontSize: 34,
    letterSpacing: 2,
    color: COLOR.ink,
    opacity: 0.05,
    transform: "rotate(-30deg)",
  },
  // Footer chrome is positioned from the TOP of the A4 page (height 841.89pt)
  // rather than with `bottom:` — react-pdf mis-resolves the container height for
  // `fixed` + `position:absolute` + `bottom` elements on some pages of a long
  // document, yielding a garbage coordinate (~1e21) that aborts the whole export.
  // Anchoring from the top sidesteps that resolution entirely.
  footerRule: {
    position: "absolute",
    top: 807,
    left: 48,
    right: 48,
    borderTopWidth: 0.5,
    borderTopColor: COLOR.lineSoft,
  },
  footerNotice: {
    position: "absolute",
    top: 811,
    left: 48,
    fontSize: 7.5,
    color: COLOR.faint,
  },
  footerPage: {
    position: "absolute",
    top: 811,
    right: 48,
    fontSize: 7.5,
    color: COLOR.faint,
    textAlign: "right",
  },

  // sections
  section: { marginTop: 18 },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    letterSpacing: 1.1,
    color: COLOR.muted,
    textTransform: "uppercase",
    borderBottomWidth: 0.75,
    borderBottomColor: COLOR.line,
    paddingBottom: 4,
    marginBottom: 8,
  },
  para: { marginBottom: 4 },
  muted: { color: COLOR.muted },
  empty: { color: COLOR.faint, fontStyle: "italic" },

  // field grid (two columns)
  fieldGrid: { flexDirection: "row", flexWrap: "wrap" },
  field: { width: "50%", paddingRight: 12, marginBottom: 7 },
  fieldLabel: {
    fontSize: 7.5,
    letterSpacing: 0.5,
    color: COLOR.muted,
    textTransform: "uppercase",
    marginBottom: 1,
  },
  fieldValue: { fontSize: 9.5 },

  // tags
  tagRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  tag: {
    fontSize: 7.5,
    color: COLOR.muted,
    borderWidth: 0.75,
    borderColor: COLOR.line,
    borderRadius: 3,
    paddingVertical: 1.5,
    paddingHorizontal: 5,
    marginRight: 5,
    marginBottom: 5,
  },

  // tables
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: COLOR.line,
    paddingBottom: 3,
  },
  tableHeadCell: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    letterSpacing: 0.4,
    color: COLOR.muted,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR.lineSoft,
    paddingVertical: 4,
  },
  tableCell: { fontSize: 9, paddingRight: 6 },

  // recommendation callout
  callout: {
    borderLeftWidth: 3,
    borderLeftColor: COLOR.ink,
    paddingLeft: 10,
    paddingVertical: 2,
  },
})

// ---- page chrome ------------------------------------------------------------

/** Faint diagonal confidentiality stamp, repeated on every page (fixed). */
export function Watermark() {
  return (
    <Text style={styles.watermark} fixed>
      {WATERMARK_TEXT}
    </Text>
  )
}

/**
 * Repeated footer with the confidentiality notice and live page numbers. Built
 * from independent `fixed` leaves rather than a container: a fixed View wrapping a
 * `render`-driven Text does not reliably repeat across pages in react-pdf.
 */
export function Footer() {
  return (
    <>
      <View style={styles.footerRule} fixed />
      <Text style={styles.footerNotice} fixed>
        {CONFIDENTIAL_NOTICE}
      </Text>
      <Text
        style={styles.footerPage}
        fixed
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </>
  )
}

// ---- section scaffolding ----------------------------------------------------

export function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  // The section may span multiple pages (long tables), so it must be allowed to
  // wrap — forcing `wrap={false}` on a section taller than a page makes react-pdf
  // collapse every child onto one page with overlapping text. `minPresenceAhead`
  // keeps the title from being orphaned at the very bottom of a page.
  return (
    <View style={styles.section}>
      <View wrap={false} minPresenceAhead={48}>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  )
}

export function Para({
  children,
  muted,
}: {
  children: React.ReactNode
  muted?: boolean
}) {
  return (
    <Text style={[styles.para, ...(muted ? [styles.muted] : [])]}>
      {children}
    </Text>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <Text style={styles.empty}>{children}</Text>
}

// ---- fields -----------------------------------------------------------------

export function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  )
}

export function FieldGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.fieldGrid}>{children}</View>
}

// ---- tags -------------------------------------------------------------------

export function Tags({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <View style={styles.tagRow}>
      {items.map((t, i) => (
        <Text key={`${t}-${i}`} style={styles.tag}>
          {t}
        </Text>
      ))}
    </View>
  )
}

// ---- tables -----------------------------------------------------------------

export function Table({
  columns,
  rows,
}: {
  columns: { header: string; width: number }[]
  /** Each row is one cell per column: a string, or `[text, color]` to tint it. */
  rows: (string | [string, string])[][]
}) {
  return (
    <View>
      {/* Keep the header with the first rows so it never strands at a page foot. */}
      <View style={styles.tableHead} wrap={false} minPresenceAhead={40}>
        {columns.map((c, i) => (
          <Text key={i} style={[styles.tableHeadCell, { flex: c.width }]}>
            {c.header}
          </Text>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.tableRow} wrap={false}>
          {row.map((cell, ci) => {
            const [text, color] = Array.isArray(cell) ? cell : [cell, COLOR.ink]
            return (
              <Text
                key={ci}
                style={[
                  styles.tableCell,
                  { flex: columns[ci]?.width ?? 1, color },
                ]}
              >
                {text}
              </Text>
            )
          })}
        </View>
      ))}
    </View>
  )
}
