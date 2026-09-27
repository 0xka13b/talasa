import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"
import { ChatPanelProvider, useChatPanel } from "./chat-panel-context"

const wrapper = ({ children }: { children: ReactNode }) => <ChatPanelProvider>{children}</ChatPanelProvider>

describe("useChatPanel", () => {
  it("open(subject) opens and sets the subject", () => {
    const { result } = renderHook(() => useChatPanel(), { wrapper })
    act(() => result.current.open({ type: "screening", id: "s1", name: "MV Test" }))
    expect(result.current.isOpen).toBe(true)
    expect(result.current.subject).toEqual({ type: "screening", id: "s1", name: "MV Test" })
  })

  it("toggle() flips open/closed", () => {
    const { result } = renderHook(() => useChatPanel(), { wrapper })
    act(() => result.current.toggle({ type: "project", id: "p1", name: "Acme" }))
    expect(result.current.isOpen).toBe(true)
    act(() => result.current.toggle())
    expect(result.current.isOpen).toBe(false)
  })

  it("setSubject() re-targets the panel without changing open state", () => {
    const { result } = renderHook(() => useChatPanel(), { wrapper })
    act(() => result.current.open({ type: "screening", id: "s1", name: "A" }))
    act(() => result.current.setSubject({ type: "project", id: "p2", name: "B" }))
    expect(result.current.isOpen).toBe(true)
    expect(result.current.subject).toEqual({ type: "project", id: "p2", name: "B" })
  })

  it("close() closes the panel", () => {
    const { result } = renderHook(() => useChatPanel(), { wrapper })
    act(() => result.current.open({ type: "project", id: "p1", name: "Acme" }))
    act(() => result.current.close())
    expect(result.current.isOpen).toBe(false)
  })
})
