import { IconMessageChatbot } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { useChatPanel, type ChatSubject } from "./chat-panel-context"

export function ChatWithAgentButton({
  subject,
  disabled,
  disabledReason,
}: {
  subject: ChatSubject
  /** Disable while there's nothing to talk about yet (e.g. run in progress). */
  disabled?: boolean
  disabledReason?: string
}) {
  const { toggle, isOpen } = useChatPanel()
  // Wrapper span carries the tooltip: a disabled button doesn't fire pointer
  // events, so a `title` on it wouldn't surface.
  return (
    <span title={disabled ? disabledReason : undefined} className="inline-flex">
      <Button
        variant={isOpen ? "secondary" : "outline"}
        disabled={disabled}
        onClick={() => toggle(subject)}
      >
        <IconMessageChatbot className="size-4" />
        Ask Agent
      </Button>
    </span>
  )
}
