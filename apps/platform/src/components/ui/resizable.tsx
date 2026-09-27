import { IconGripVertical } from "@tabler/icons-react"
import { Group, Panel, Separator } from "react-resizable-panels"

import { cn } from "@/lib/utils"

// react-resizable-panels v4 renamed its primitives to Group / Panel / Separator
// and uses `orientation` instead of `direction`. We keep the familiar shadcn
// names + a `direction` alias so callers read conventionally.
function ResizablePanelGroup({
  className,
  direction,
  ...props
}: Omit<React.ComponentProps<typeof Group>, "orientation"> & {
  direction?: "horizontal" | "vertical"
}) {
  return (
    <Group
      data-slot="resizable-panel-group"
      orientation={direction ?? "horizontal"}
      className={cn("h-full w-full", className)}
      {...props}
    />
  )
}

function ResizablePanel(props: React.ComponentProps<typeof Panel>) {
  return <Panel data-slot="resizable-panel" {...props} />
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof Separator> & { withHandle?: boolean }) {
  return (
    <Separator
      data-slot="resizable-handle"
      className={cn(
        "relative flex w-1.5 items-center justify-center bg-border transition-colors hover:bg-primary/40 data-[separator=active]:bg-primary/60",
        className,
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-5 w-3 items-center justify-center rounded-xs border bg-border">
          <IconGripVertical className="size-2.5" />
        </div>
      )}
    </Separator>
  )
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup }
