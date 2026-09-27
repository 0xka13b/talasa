import { Link } from "@tanstack/react-router"
import { IconShieldHalf } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"

const STEPS = [
  "Enter a vessel's 7-digit IMO number.",
  "We resolve ownership & management, then screen sanctions, sister vessels, and adverse media.",
  "Review the risk verdict and the full intelligence brief.",
]

export function VesselScreeningEmpty() {
  return (
    <div className="flex flex-col items-center gap-6 rounded-lg border border-dashed px-6 py-16 text-center">
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <IconShieldHalf className="size-6" />
      </div>
      <div className="flex max-w-md flex-col gap-2">
        <h2 className="text-lg font-semibold">No screenings yet</h2>
        <p className="text-muted-foreground text-sm">
          Vessel screening checks a ship&apos;s ownership, sanctions exposure, sister fleet, and
          adverse media — and gives you a risk verdict you can act on.
        </p>
      </div>
      <ol className="flex max-w-md flex-col gap-3 text-left">
        {STEPS.map((step, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="bg-primary/10 text-primary flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-medium">
              {i + 1}
            </span>
            <span className="text-muted-foreground">{step}</span>
          </li>
        ))}
      </ol>
      <Link to="/vessel-screening/new">
        <Button>Start a screening</Button>
      </Link>
    </div>
  )
}
