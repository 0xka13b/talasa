import { memo } from "react"
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react"
import { IconX } from "@tabler/icons-react"
import { useBoardActions } from "./board-context"

/**
 * A user-drawn connector between two board nodes. Rendered dashed and arrow-less
 * so it reads as an annotation rather than part of the derived relationship
 * graph. When selected it shows a small delete affordance (mirroring the
 * annotation nodes), routed back through the board's autosave.
 */
function BoardConnectorEdgeComp({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
}: EdgeProps) {
  const { removeEdge } = useBoardActions()
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{ stroke: "var(--muted-foreground)", strokeWidth: 1.5, strokeDasharray: "6 4" }}
      />
      {selected && (
        <EdgeLabelRenderer>
          <button
            type="button"
            aria-label="Delete connector"
            onClick={() => removeEdge(id)}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: "all" }}
            className="nodrag nopan text-muted-foreground hover:text-foreground bg-background absolute rounded-full border p-0.5 shadow-sm"
          >
            <IconX className="size-3" />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export const BoardConnectorEdge = memo(BoardConnectorEdgeComp)
