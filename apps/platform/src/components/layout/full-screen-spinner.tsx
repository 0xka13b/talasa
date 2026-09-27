import { Skeleton } from "@/components/ui/skeleton"

export function FullScreenSpinner() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Skeleton className="h-24 w-64" />
    </div>
  )
}
