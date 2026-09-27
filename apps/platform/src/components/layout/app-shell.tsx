import type { ReactNode } from "react"
import { useEffect } from "react"
import { useMatchRoute, useRouterState } from "@tanstack/react-router"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { ChatPanel } from "@/components/chat/chat-panel"
import { ChatPanelProvider, useChatPanel } from "@/components/chat/chat-panel-context"
import { VesselScreeningSidebarProvider } from "@/components/vessel-screening/vessel-screening-sidebar"
import { DDSidebarProvider } from "@/components/counterparty-dd/dd-sidebar"
import { AppHeader } from "./app-header"
import { AppFooter } from "./app-footer"

interface AppShellProps {
  name: string
  email: string
  children: ReactNode
}

/**
 * Closes the chat panel whenever the route is not a subject detail page, so the
 * panel never lingers on the dashboard, settings, etc.
 */
function ChatRouteSync() {
  const matchRoute = useMatchRoute()
  const isIdle = useRouterState({ select: (s) => s.status === "idle" })
  const { isOpen, close } = useChatPanel()
  const onSubjectRoute = Boolean(
    matchRoute({ to: "/vessel-screening/$screeningId" }) || matchRoute({ to: "/counterparty-dd/$projectId" }),
  )
  useEffect(() => {
    // Only close once navigation has settled, so opening the panel as part of a
    // navigation isn't torn down mid-transition.
    if (isIdle && isOpen && !onSubjectRoute) close()
  }, [isIdle, isOpen, onSubjectRoute, close])
  return null
}

/**
 * The content region. When the chat panel is open, split it into a resizable
 * horizontal group (page content | chat). Otherwise render the page full-width.
 */
function AppShellBody({ children }: { children: ReactNode }) {
  const { isOpen } = useChatPanel()

  if (!isOpen) {
    return (
      <>
        <main className="min-h-0 flex-1 overflow-y-auto p-6">{children}</main>
        <AppFooter />
      </>
    )
  }

  return (
    // The shell above already pins this row's height to the viewport (header
    // and footer are fixed-height flex siblings), so the group can just fill
    // it (react-resizable-panels v4 defaults to height:100%) instead of
    // re-deriving the viewport math with an inline style.
    <ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1">
      <ResizablePanel defaultSize="66%" minSize="38%" className="flex h-full min-w-0 flex-col">
        <main className="min-h-0 flex-1 overflow-y-auto p-6">{children}</main>
        <AppFooter />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="34%" minSize="24%" maxSize="55%" className="flex h-full min-w-0 flex-col">
        <ChatPanel />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

export function AppShell({ name, email, children }: AppShellProps) {
  return (
    <ChatPanelProvider>
      <VesselScreeningSidebarProvider>
        <DDSidebarProvider>
          <ChatRouteSync />
          <div className="flex h-svh flex-col overflow-hidden">
            <AppHeader name={name} email={email} />
            <div className="flex min-h-0 flex-1 flex-col">
              <AppShellBody>{children}</AppShellBody>
            </div>
          </div>
        </DDSidebarProvider>
      </VesselScreeningSidebarProvider>
    </ChatPanelProvider>
  )
}
