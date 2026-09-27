import { createFileRoute } from "@tanstack/react-router"
import { WipPlaceholder } from "@/components/layout/wip-placeholder"

export const Route = createFileRoute("/_authed/fixture-market")({ component: FixtureMarketPage })

function FixtureMarketPage() {
  return <WipPlaceholder title="Fixture Market" />
}
