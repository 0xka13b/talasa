import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { IconRadar2 } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { MonitorForm } from "./monitor-form"

/** Report action-bar button: open a dialog to start a recurring monitor on THIS
 * vessel, pre-filled and locked to its IMO. */
export function MonitorThisVesselButton({ imo, name }: { imo: string; name?: string | null }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            <IconRadar2 className="size-4" />
            Monitor
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Monitor this vessel</DialogTitle>
          <DialogDescription>Re-screen it on a schedule and get alerted when the checks you pick change.</DialogDescription>
        </DialogHeader>
        <MonitorForm
          lockedTarget={{ kind: "vessel", imo, name }}
          onCreated={(id) => {
            setOpen(false)
            navigate({ to: "/vessel-screening/monitoring/$monitorId", params: { monitorId: id } })
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
