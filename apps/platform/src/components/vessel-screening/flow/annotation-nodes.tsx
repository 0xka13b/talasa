import { memo } from "react"
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react"
import { IconBan, IconX } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { useBoardActions } from "./board-context"
import type { ShapeFlowNode, TextFlowNode } from "./to-flow"

// Preset accent colours offered on a selected annotation. Values are plain hex
// so an 8-digit alpha suffix (below) yields a soft fill from the same swatch.
const SWATCHES: { name: string; value: string }[] = [
  { name: "Amber", value: "#f59e0b" },
  { name: "Red", value: "#ef4444" },
  { name: "Green", value: "#22c55e" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Violet", value: "#a855f7" },
  { name: "Slate", value: "#64748b" },
]

/**
 * Floating control bar shown on a selected annotation: colour swatches (routed
 * through the board autosave) plus a delete affordance.
 */
function AnnotationToolbar({ id, color }: { id: string; color: string | null }) {
  const { updateAnnotationColor, removeAnnotation } = useBoardActions()
  return (
    <div className="nodrag nopan bg-background absolute -top-9 left-0 z-10 flex items-center gap-1 rounded-md border p-1 shadow-sm">
      <button
        type="button"
        aria-label="Default colour"
        onClick={() => updateAnnotationColor(id, null)}
        className={cn(
          "text-muted-foreground hover:text-foreground grid size-4 place-items-center rounded-full border",
          color === null && "ring-ring ring-2 ring-offset-1",
        )}
      >
        <IconBan className="size-2.5" />
      </button>
      {SWATCHES.map((s) => (
        <button
          key={s.value}
          type="button"
          aria-label={s.name}
          onClick={() => updateAnnotationColor(id, s.value)}
          style={{ backgroundColor: s.value }}
          className={cn("size-4 rounded-full border", color === s.value && "ring-ring ring-2 ring-offset-1")}
        />
      ))}
      <div className="bg-border mx-0.5 h-4 w-px" />
      <button
        type="button"
        aria-label="Delete annotation"
        onClick={() => removeAnnotation(id)}
        className="text-muted-foreground hover:text-foreground"
      >
        <IconX className="size-3.5" />
      </button>
    </div>
  )
}

/** Small target/source handles so annotations can be wired to other nodes. */
function AnnotationHandles() {
  const cls = "!size-1.5 !border-0 !bg-muted-foreground/50"
  return (
    <>
      <Handle type="target" position={Position.Top} className={cls} />
      <Handle type="source" position={Position.Bottom} className={cls} />
    </>
  )
}

/** Free-form sticky note. Editable, resizable; text + colour persist to the board. */
function TextNoteNodeComp({ id, data, selected }: NodeProps<TextFlowNode>) {
  const { updateAnnotationText, commit } = useBoardActions()
  const a = data.annotation
  const color = a.data.color
  return (
    <>
      <NodeResizer isVisible={selected} minWidth={120} minHeight={48} onResizeEnd={commit} />
      <AnnotationHandles />
      {selected && <AnnotationToolbar id={id} color={color} />}
      <div
        style={color ? { borderColor: color, backgroundColor: `${color}22` } : undefined}
        className={cn(
          "size-full rounded-md border p-1.5 shadow-sm",
          !color && "border-amber-400/70 bg-amber-100/85 dark:bg-amber-200/10",
        )}
      >
        <textarea
          // `nodrag`/`nowheel` stop React Flow from panning/zooming while typing.
          className={cn(
            "nodrag nowheel size-full resize-none bg-transparent text-xs outline-none",
            color
              ? "text-foreground placeholder:text-muted-foreground"
              : "text-amber-950 placeholder:text-amber-700/50 dark:text-amber-100",
          )}
          value={a.data.text}
          placeholder="Note…"
          onChange={(e) => updateAnnotationText(id, e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
        />
      </div>
    </>
  )
}

/** Translucent grouping rectangle that sits behind the entity cards. */
function ShapeBoxNodeComp({ id, data, selected }: NodeProps<ShapeFlowNode>) {
  const { commit } = useBoardActions()
  const color = data.annotation.data.color
  return (
    <>
      <NodeResizer isVisible={selected} minWidth={80} minHeight={60} onResizeEnd={commit} />
      <AnnotationHandles />
      {selected && <AnnotationToolbar id={id} color={color} />}
      <div
        style={color ? { borderColor: color, backgroundColor: `${color}14` } : undefined}
        className={cn(
          "size-full rounded-lg border-2 border-dashed",
          !color && "border-muted-foreground/40 bg-muted-foreground/5",
        )}
      />
    </>
  )
}

export const TextNoteNode = memo(TextNoteNodeComp)
export const ShapeBoxNode = memo(ShapeBoxNodeComp)
