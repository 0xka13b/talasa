import { IconArrowUp, IconPaperclip, IconPlayerStopFilled } from "@tabler/icons-react"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

interface ChatInputProps {
  onSend: (text: string) => void
  onStop: () => void
  status: string
  disabled?: boolean
}

export function ChatInput({ onSend, onStop, status, disabled }: ChatInputProps) {
  const [value, setValue] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isStreaming = status === "submitted" || status === "streaming"

  const submit = () => {
    const text = value.trim()
    if (!text || isStreaming || disabled) return
    onSend(text)
    setValue("")
    // Reset the autosized height.
    if (textareaRef.current) textareaRef.current.style.height = "auto"
  }

  return (
    <div className="border-t p-2.5">
      <div className="flex items-end gap-1.5 rounded-xl border bg-background p-1.5 focus-within:border-ring">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label="Attach files"
          onClick={() => toast("File attachments are coming soon")}
        >
          <IconPaperclip className="size-4" />
        </Button>

        <textarea
          ref={textareaRef}
          value={value}
          rows={1}
          disabled={disabled}
          placeholder="Ask about this subject…"
          className="max-h-40 flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
          onChange={(e) => {
            setValue(e.target.value)
            e.target.style.height = "auto"
            e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
        />

        {isStreaming ? (
          <Button
            type="button"
            variant="destructive"
            size="icon-sm"
            className="shrink-0"
            aria-label="Stop"
            onClick={onStop}
          >
            <IconPlayerStopFilled className="size-4" />
          </Button>
        ) : (
          <Button
            type="button"
            size="icon-sm"
            className="shrink-0"
            aria-label="Send"
            disabled={!value.trim() || disabled}
            onClick={submit}
          >
            <IconArrowUp className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
