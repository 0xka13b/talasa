import { createFileRoute, Outlet } from "@tanstack/react-router"
import { DDMobileTrigger, DDSidebar } from "@/components/counterparty-dd/dd-sidebar"

export const Route = createFileRoute("/_authed/counterparty-dd")({
  component: CounterpartyDDLayout,
})

/**
 * List-then-detail shell: a persistent projects list on the left, the
 * selected project's workspace on the right (`Outlet`). Matches the same
 * split used for vessel screening.
 */
function CounterpartyDDLayout() {
  return (
    // `h-full` + default `items-stretch` makes this row exactly as tall as
    // `main`'s content box (the fixed band between header and footer), so
    // the sidebar and the outlet are two independently scrolling columns
    // rather than one document-length page.
    <div className="flex h-full gap-6">
      <DDSidebar />
      <div className="min-w-0 flex-1 overflow-y-auto">
        <DDMobileTrigger />
        <Outlet />
      </div>
    </div>
  )
}
