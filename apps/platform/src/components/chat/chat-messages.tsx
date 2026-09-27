import type { UIMessage } from "ai"
import { useEffect, useRef, useState } from "react"
import { IconRobot } from "@tabler/icons-react"
import { Streamdown } from "streamdown"
import { cn } from "@/lib/utils"
import { ReasoningCard } from "./reasoning-card"
import { ToolCallCard } from "./tool-call-card"

interface ChatMessagesProps {
  messages: UIMessage[]
  status: string
  suggestions?: string[]
  onSuggestion?: (text: string) => void
}

export function ChatMessages({ messages, status, suggestions, onSuggestion }: ChatMessagesProps) {
  const endRef = useRef<HTMLDivElement>(null)

  // Keep the newest content in view as tokens stream in.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, status])

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="max-w-xs text-sm text-muted-foreground">
          Ask the agent about this subject. It can read the report&apos;s sanctions, ownership, fleet, and
          relationship graph.
        </p>
        {suggestions && suggestions.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSuggestion?.(s)}
                className="rounded-[4px] border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Show a "thinking" indicator between hitting send and the first token/tool
  // part rendering — otherwise a slow first response looks frozen. Once the
  // assistant has produced any visible part, its own streaming content is the
  // progress signal, so drop the indicator.
  const last = messages[messages.length - 1]
  const assistantStarted =
    last?.role === "assistant" &&
    last.parts.some(
      (p) =>
        (p.type === "text" && p.text.length > 0) ||
        (p.type === "reasoning" && p.text.length > 0) ||
        p.type.startsWith("tool-") ||
        p.type === "dynamic-tool",
    )
  const showThinking = status === "submitted" || (status === "streaming" && !assistantStarted)

  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
      {messages.map((message) => (
        <MessageRow key={message.id} message={message} />
      ))}
      {showThinking && <ThinkingIndicator />}
      <div ref={endRef} />
    </div>
  )
}

const BITS_LEN = 7
const randomBits = () => {
  let s = ""
  for (let i = 0; i < BITS_LEN; i++) s += Math.random() < 0.5 ? "0" : "1"
  return s
}

/**
 * "Computer thinking" indicator shown while awaiting the first response part: a
 * robot icon next to a 7-symbol binary readout that reshuffles a few times a
 * second, with a pulsing opacity to signal work in progress.
 */
function ThinkingIndicator() {
  const [bits, setBits] = useState(randomBits)
  useEffect(() => {
    const id = setInterval(() => setBits(randomBits()), 110)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="flex animate-pulse items-center gap-2 text-sm text-muted-foreground" aria-live="polite" aria-label="Agent is thinking">
      <IconRobot className="size-4" />
      <span className="font-mono tabular-nums tracking-[0.35em] select-none">{bits}</span>
    </div>
  )
}

/** "15 Jul 2026, 14:32" */
function formatSentAt(iso?: string): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function MessageRow({ message }: { message: UIMessage }) {
  const sentAt = formatSentAt((message.metadata as { createdAt?: string } | undefined)?.createdAt)

  if (message.role === "user") {
    const text = message.parts
      .map((p) => (p.type === "text" ? p.text : ""))
      .join("")
      .trim()
    return (
      <div className="flex flex-col items-end gap-0.5">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground whitespace-pre-wrap">
          {text}
        </div>
        {sentAt && <span className="px-1 text-[11px] text-muted-foreground">{sentAt}</span>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {message.parts.map((part, i) => {
        if (part.type === "text") {
          return (
            <div key={i} className={cn("max-w-none text-sm leading-relaxed [&_pre]:overflow-x-auto")}>
              <Streamdown>{part.text}</Streamdown>
            </div>
          )
        }
        if (part.type === "reasoning" && part.text) {
          return <ReasoningCard key={i} text={part.text} state={part.state} />
        }
        // Static tool parts are typed "tool-<name>"; dynamic tools use "dynamic-tool".
        if (part.type.startsWith("tool-")) {
          const p = part as unknown as { state?: string; input?: unknown; output?: unknown; errorText?: string }
          return (
            <ToolCallCard
              key={i}
              name={part.type.slice("tool-".length)}
              state={p.state}
              input={p.input}
              output={p.output}
              errorText={p.errorText}
            />
          )
        }
        if (part.type === "dynamic-tool") {
          const p = part as unknown as {
            toolName: string
            state?: string
            input?: unknown
            output?: unknown
            errorText?: string
          }
          return (
            <ToolCallCard key={i} name={p.toolName} state={p.state} input={p.input} output={p.output} errorText={p.errorText} />
          )
        }
        return null
      })}
      {sentAt && <span className="text-[11px] text-muted-foreground">{sentAt}</span>}
    </div>
  )
}
