import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { ChatSubjectType } from "@talasa/shared"

export interface ChatSubject {
  type: ChatSubjectType
  id: string
  name: string
}

interface ChatPanelState {
  isOpen: boolean
  /** The subject whose chat the panel shows — driven by the current route. */
  subject: ChatSubject | null
  /** Open the panel; optionally set/replace the current subject. */
  open: (subject?: ChatSubject) => void
  /** Toggle the panel for the current (or given) subject. */
  toggle: (subject?: ChatSubject) => void
  close: () => void
  /** Register the current route's subject (called by detail pages + nav). */
  setSubject: (subject: ChatSubject | null) => void
}

const ChatPanelContext = createContext<ChatPanelState | null>(null)

export function ChatPanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [subject, setSubject] = useState<ChatSubject | null>(null)

  const open = useCallback((next?: ChatSubject) => {
    if (next) setSubject(next)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => setIsOpen(false), [])

  const toggle = useCallback((next?: ChatSubject) => {
    setIsOpen((prev) => {
      if (!prev && next) setSubject(next)
      return !prev
    })
  }, [])

  const value = useMemo<ChatPanelState>(
    () => ({ isOpen, subject, open, toggle, close, setSubject }),
    [isOpen, subject, open, toggle, close],
  )

  return <ChatPanelContext.Provider value={value}>{children}</ChatPanelContext.Provider>
}

export function useChatPanel(): ChatPanelState {
  const ctx = useContext(ChatPanelContext)
  if (!ctx) throw new Error("useChatPanel must be used within a ChatPanelProvider")
  return ctx
}

/**
 * Registers the current route's subject with the panel. Detail pages call this
 * so the chat panel follows the page: switching between subjects re-targets the
 * panel at the new subject's chat while it stays open.
 */
export function useRegisterChatSubject(subject: ChatSubject) {
  const { setSubject } = useChatPanel()
  const { type, id, name } = subject
  useEffect(() => {
    setSubject({ type, id, name })
  }, [setSubject, type, id, name])
}
