import { lazy, Suspense, useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { IconBuilding, IconShip } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"

// three.js is a heavy dependency for a decorative backdrop, so it's
// code-split and only pulled in once the dashboard actually mounts.
const OceanBackground = lazy(() =>
  import("./ocean-background").then((m) => ({ default: m.OceanBackground }))
)

// Cycled through by the typewriter — each is a thing the analyst can do here.
const PHRASES = [
  "Screen a vessel against global sanctions.",
  "Run due diligence on a counterparty.",
  "Trace corporate ownership and parents.",
  "Uncover shadow-fleet networks.",
]

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

export function WelcomeHero({ firstName }: { firstName?: string }) {
  return (
    <section className="relative flex min-h-[50vh] flex-col items-center justify-center gap-8 text-center">
      <Suspense fallback={null}>
        <OceanBackground />
      </Suspense>

      <div className="flex flex-col gap-3">
        <h1 className="animate-in text-3xl font-semibold tracking-tight duration-700 fade-in slide-in-from-bottom-3 sm:text-4xl">
          {greeting()}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p
          className="min-h-[1.75rem] animate-in text-base text-muted-foreground duration-700 [animation-delay:150ms] fade-in slide-in-from-bottom-3 sm:text-lg"
          style={{ animationFillMode: "backwards" }}
        >
          <Typewriter phrases={PHRASES} />
        </p>
      </div>

      <div
        className="flex animate-in flex-col gap-3 duration-700 [animation-delay:300ms] fade-in slide-in-from-bottom-3 sm:flex-row"
        style={{ animationFillMode: "backwards" }}
      >
        <Link to="/vessel-screening/new">
          <Button size="lg" className="h-12 px-6 text-base">
            <IconShip className="size-5" />
            Start vessel screening
          </Button>
        </Link>
        <Link to="/counterparty-dd/new">
          <Button size="lg" variant="outline" className="h-12 px-6 text-base">
            <IconBuilding className="size-5" />
            Start counterparty screening
          </Button>
        </Link>
      </div>
    </section>
  )
}

/** Types a phrase, pauses, deletes, and moves to the next — looping forever. */
function Typewriter({ phrases }: { phrases: string[] }) {
  const [index, setIndex] = useState(0)
  const [text, setText] = useState("")
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const phrase = phrases[index]

    if (!deleting && text === phrase) {
      const t = setTimeout(() => setDeleting(true), 1900)
      return () => clearTimeout(t)
    }
    if (deleting && text === "") {
      setDeleting(false)
      setIndex((i) => (i + 1) % phrases.length)
      return
    }

    const t = setTimeout(
      () =>
        setText((cur) =>
          deleting ? cur.slice(0, -1) : phrase.slice(0, cur.length + 1)
        ),
      deleting ? 35 : 65
    )
    return () => clearTimeout(t)
  }, [text, deleting, index, phrases])

  return (
    <span>
      {text}
      <span className="ml-0.5 inline-block w-px animate-pulse bg-current align-middle text-transparent">
        |
      </span>
    </span>
  )
}
