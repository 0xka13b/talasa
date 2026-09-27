export function WipPlaceholder({ title }: { title: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-center">
      <span className="text-4xl" role="img" aria-label="Under construction">
        🚧
      </span>
      <p className="text-sm font-medium">Work in progress</p>
      <p className="max-w-xs text-sm text-muted-foreground">{title} is under active development. Check back soon.</p>
    </div>
  )
}
