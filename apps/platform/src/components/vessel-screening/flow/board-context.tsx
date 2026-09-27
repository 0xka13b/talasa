import { createContext, useContext } from "react"

/**
 * Actions the annotation nodes call back into the board with. Kept in its own
 * module so the node components and the board don't import each other (cycle).
 */
export interface BoardActions {
  updateAnnotationText: (id: string, text: string) => void
  /** Set an annotation's accent colour (hex), or null for the theme default. */
  updateAnnotationColor: (id: string, color: string | null) => void
  removeAnnotation: (id: string) => void
  /** Remove a user-drawn connector edge. */
  removeEdge: (id: string) => void
  /** Flag the board dirty and schedule a debounced autosave (e.g. after a resize). */
  commit: () => void
}

const BoardCtx = createContext<BoardActions | null>(null)
export const BoardProvider = BoardCtx.Provider

export function useBoardActions(): BoardActions {
  const v = useContext(BoardCtx)
  if (!v) throw new Error("useBoardActions must be used within a board")
  return v
}
