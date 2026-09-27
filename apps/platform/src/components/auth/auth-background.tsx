/**
 * Shared chrome for the auth pages (login / register).
 *
 * `AuthBackground` is a decorative, theme-aware backdrop: a faint blueprint
 * grid, a set of sonar/radar rings evoking the maritime domain, and a soft
 * central glow. Everything is drawn with `currentColor`/palette tokens at low
 * opacity and radially masked toward the middle, so it reads as texture behind
 * the form rather than competing with it — and it adapts to whichever
 * palette/mode is active.
 *
 * `AuthBrand` is the Talasa logotype shown above the form.
 */
export function AuthBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* base wash */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-muted/40" />

      {/* blueprint grid, faded toward the center where the card sits */}
      <div
        className="absolute inset-0 text-foreground/[0.05] [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black_90%)]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      {/* concentric sonar rings */}
      <svg
        className="absolute left-1/2 top-1/2 h-[140vmin] w-[140vmin] -translate-x-1/2 -translate-y-1/2 text-foreground/[0.07]"
        viewBox="0 0 800 800"
        fill="none"
      >
        {[120, 220, 320, 400].map((r) => (
          <circle key={r} cx="400" cy="400" r={r} stroke="currentColor" strokeWidth="1" />
        ))}
        <line x1="400" y1="0" x2="400" y2="800" stroke="currentColor" strokeWidth="1" />
        <line x1="0" y1="400" x2="800" y2="400" stroke="currentColor" strokeWidth="1" />
      </svg>

      {/* soft central glow to lift the form off the grid */}
      <div className="absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,var(--color-primary)_0%,transparent_70%)] opacity-[0.08] blur-3xl" />
    </div>
  )
}

export function AuthBrand() {
  return (
    <div className="relative z-10 flex items-center gap-2.5">
      <span className="grid size-8 place-items-center border border-border bg-black dark:bg-card">
        <img src="/logo-variant.png" alt="Talasa" className="size-6 object-contain" decoding="async" />
      </span>
      <span className="font-mono text-base tracking-widest text-foreground">TALASA</span>
    </div>
  )
}
