function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Wraps substrings of `text` matching `query` (case-insensitive) in a highlight span. */
export function highlightMatches(text: string, query: string) {
  if (!query) return text
  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, "ig"))
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <span key={i} className="bg-sky-500/20 text-sky-600 dark:text-sky-400">
        {part}
      </span>
    ) : (
      part
    )
  )
}
