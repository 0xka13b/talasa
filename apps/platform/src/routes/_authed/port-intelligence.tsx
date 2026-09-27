import { createFileRoute } from "@tanstack/react-router"
import { WipPlaceholder } from "@/components/layout/wip-placeholder"

export const Route = createFileRoute("/_authed/port-intelligence")({ component: PortIntelligencePage })

function PortIntelligencePage() {
  return <WipPlaceholder title="Port Intelligence" />
}
