import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { CreateProjectInput } from "@talasa/shared"

const EMPTY: CreateProjectInput = {
  counterpartyName: "",
  name: "",
  vesselName: "",
  companyImo: "",
  vesselMmsi: "",
  notes: "",
}

export function CreateProjectDialog({
  pending,
  onCreate,
}: {
  pending: boolean
  onCreate: (input: CreateProjectInput) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<CreateProjectInput>(EMPTY)
  const set =
    (key: keyof CreateProjectInput) =>
    (e: { target: { value: string } }) =>
      setValues((v) => ({ ...v, [key]: e.target.value }))

  return (
    <Dialog open={open} onOpenChange={(next) => setOpen(next)}>
      <DialogTrigger render={<Button>New project</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New due-diligence project</DialogTitle>
          <DialogDescription>
            One project = one vetting run for one vessel.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault()
            await onCreate(values)
            setValues(EMPTY)
            setOpen(false)
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="name">Project name</Label>
            <Input id="name" value={values.name ?? ""} onChange={set("name")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="vesselName">Vessel name</Label>
            <Input
              id="vesselName"
              value={values.vesselName ?? ""}
              onChange={set("vesselName")}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="companyImo">Company IMO</Label>
              <Input
                id="companyImo"
                value={values.companyImo ?? ""}
                onChange={set("companyImo")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mmsi">MMSI</Label>
              <Input
                id="mmsi"
                value={values.vesselMmsi ?? ""}
                onChange={set("vesselMmsi")}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="counterparty">Counterparty</Label>
            <Input
              id="counterparty"
              value={values.counterpartyName}
              onChange={set("counterpartyName")}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={values.notes ?? ""}
              onChange={set("notes")}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
