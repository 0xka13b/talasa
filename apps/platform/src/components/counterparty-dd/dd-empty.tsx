import { Link } from "@tanstack/react-router"
import { IconBuilding } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"

const STEPS = [
  "Enter a counterparty's name (and IMO or country, if known).",
  "We resolve the corporate entity, then screen sanctions, ownership, fleet, and its wider network.",
  "Review the risk band and the full due-diligence brief.",
]

export function DDEmpty() {
  return (
    <div className="flex flex-col items-center gap-6 rounded-lg border border-dashed px-6 py-16 text-center">
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <IconBuilding className="size-6" />
      </div>
      <div className="flex max-w-md flex-col gap-2">
        <h2 className="text-lg font-semibold">No counterparty checks yet</h2>
        <p className="text-muted-foreground text-sm">
          Counterparty due diligence checks sanctions exposure, corporate ownership, fleet, and the
          wider corporate network — and gives you a risk band you can act on.
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
      <Link to="/counterparty-dd/new">
        <Button>Start a counterparty check</Button>
      </Link>
    </div>
  )
}
