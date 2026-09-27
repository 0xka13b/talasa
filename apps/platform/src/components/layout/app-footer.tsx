import { SystemStatus } from "@/components/layout/system-status"

export function AppFooter() {
  return (
    <footer className="text-muted-foreground border-t bg-background sticky bottom-0 z-10 p-2 text-xs">
      <div className="flex items-center justify-between">
        <span>Talasa — Maritime Risk Intelligence</span>
        <SystemStatus />
      </div>
    </footer>
  )
}
