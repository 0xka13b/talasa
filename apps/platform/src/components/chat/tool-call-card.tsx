import { IconAlertTriangle, IconCheck, IconChevronRight, IconLoader2, IconTool } from "@tabler/icons-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

export interface ToolCallCardProps {
  /** Tool name without the "tool-" prefix, e.g. "get_sanctions". */
  name: string
  /** AI SDK tool-part state. */
  state?: string
  input?: unknown
  output?: unknown
  errorText?: string
}

const LABELS: Record<string, string> = {
  get_overview: "Reading the overview",
  get_sanctions: "Checking sanctions",
  get_ownership: "Reading ownership",
  get_corporate_network: "Mapping the corporate network",
  get_fleet: "Reading the fleet",
  get_ais_events: "Reading AIS behaviour",
  get_incidents: "Reading incidents",
  list_entities: "Listing entities",
  get_entity: "Inspecting an entity",
}

function humanize(name: string) {
  return LABELS[name] ?? name.replace(/_/g, " ")
}

export function ToolCallCard({ name, state, input, output, errorText }: ToolCallCardProps) {
  const isError = state === "output-error"
  const isDone = state === "output-available"
  const isRunning = !isDone && !isError

  return (
    <Collapsible className="my-1.5 rounded-lg border bg-muted/30 text-sm">
      <CollapsibleTrigger className="group/tool flex w-full items-center gap-2 px-2.5 py-1.5 text-left">
        <span className="text-muted-foreground">
          {isError ? (
            <IconAlertTriangle className="size-3.5 text-destructive" />
          ) : isDone ? (
            <IconCheck className="size-3.5 text-emerald-500" />
          ) : isRunning ? (
            <IconLoader2 className="size-3.5 animate-spin" />
          ) : (
            <IconTool className="size-3.5" />
          )}
        </span>
        <span className={cn("flex-1 truncate font-medium", isRunning && "text-muted-foreground")}>
          {humanize(name)}
        </span>
        <IconChevronRight className="size-3.5 text-muted-foreground transition-transform group-data-[panel-open]/tool:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden">
        <div className="space-y-2 border-t px-2.5 py-2 text-xs">
          {input != null && Object.keys(input as object).length > 0 && (
            <Section label="Input" value={input} />
          )}
          {isError ? (
            <div className="text-destructive">{errorText ?? "Tool failed"}</div>
          ) : output != null ? (
            <Section label="Result" value={output} />
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function Section({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div className="mb-1 font-medium text-muted-foreground">{label}</div>
      <pre className="max-h-64 overflow-auto rounded-md bg-background/60 p-2 text-[11px] leading-relaxed">
        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  )
}
