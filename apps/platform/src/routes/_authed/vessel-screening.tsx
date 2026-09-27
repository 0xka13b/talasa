import { createFileRoute, Outlet } from "@tanstack/react-router"
import {
  VesselScreeningMobileTrigger,
  VesselScreeningSidebar,
} from "@/components/vessel-screening/vessel-screening-sidebar"

export const Route = createFileRoute("/_authed/vessel-screening")({
  component: VesselScreeningLayout,
})

/**
 * List-then-detail shell: a persistent screenings list on the left, the
 * selected screening's workspace on the right (`Outlet`). Matches the same
 * split used for chat — list stays put while the detail pane switches.
 */
function VesselScreeningLayout() {
  return (
    // `h-full` + default `items-stretch` makes this row exactly as tall as
    // `main`'s content box (the fixed band between header and footer), so
    // the sidebar and the outlet are two independently scrolling columns
    // rather than one document-length page.
    <div className="flex h-full gap-6">
      <VesselScreeningSidebar />
      <div className="min-w-0 flex-1 overflow-y-auto">
        <VesselScreeningMobileTrigger />
        <Outlet />
      </div>
    </div>
  )
}
