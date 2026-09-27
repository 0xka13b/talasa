import { useState } from "react"
import { createScreeningSchema } from "@talasa/shared"
import type { CreateScreeningInput } from "@talasa/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function VesselIntakeForm({
  onSubmit,
  pending,
  initialImo,
}: {
  onSubmit: (input: CreateScreeningInput) => void
  pending: boolean
  /** Seed the IMO field (e.g. when deep-linked from a sister vessel). */
  initialImo?: string
}) {
  const [name, setName] = useState("")
  const [imo, setImo] = useState(initialImo ?? "")
  const [errors, setErrors] = useState<{ name?: string; imo?: string }>({})

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = createScreeningSchema.safeParse({
      name: name.trim(),
      imo: imo.trim(),
    })
    if (!parsed.success) {
      const next: { name?: string; imo?: string } = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if (field === "name") next.name ??= issue.message
        if (field === "imo") next.imo ??= issue.message
      }
      setErrors(next)
      return
    }
    setErrors({})
    onSubmit(parsed.data)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="imo">
          Vessel IMO <span className="text-destructive" aria-hidden>*</span>
        </Label>
        <Input
          id="imo"
          inputMode="numeric"
          placeholder="e.g. 9304162"
          value={imo}
          onChange={(e) => setImo(e.target.value)}
          aria-invalid={!!errors.imo}
          aria-required
        />
        {errors.imo && <p className="text-xs text-destructive">{errors.imo}</p>}
        <p className="text-xs text-muted-foreground">
          The 7-digit IMO number identifies the vessel across maritime
          registries and the sanctions lists.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">
          Screening name{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="name"
          placeholder="e.g. Acme tanker — pre-fixture check"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={!!errors.name}
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name}</p>
        )}
        <p className="text-xs text-muted-foreground">
          A label to recognize this screening later — only you see it. Leave blank
          to use the vessel's name.
        </p>
      </div>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Starting…" : "Screen vessel"}
      </Button>
    </form>
  )
}
