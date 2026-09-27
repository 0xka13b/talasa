import { IconBrain, IconChevronRight } from "@tabler/icons-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

export function ReasoningCard({ text, state }: { text: string; state?: "streaming" | "done" }) {
  const thinking = state === "streaming"

  return (
    <Collapsible className="my-1.5 rounded-lg border bg-muted/20 text-sm">
      <CollapsibleTrigger className="group/reason flex w-full items-center gap-2 px-2.5 py-1.5 text-left">
        <IconBrain className={cn("size-3.5 text-muted-foreground", thinking && "animate-pulse")} />
        <span className={cn("flex-1 text-xs font-medium", thinking ? "text-muted-foreground" : "text-foreground")}>
          {thinking ? "Thinking…" : "Thought"}
        </span>
        <IconChevronRight className="size-3.5 text-muted-foreground transition-transform group-data-[panel-open]/reason:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden">
        <div className="border-t px-2.5 py-2 text-xs whitespace-pre-wrap text-muted-foreground">{text}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}
