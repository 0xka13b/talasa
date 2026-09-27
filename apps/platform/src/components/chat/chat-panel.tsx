import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { IconLoader2, IconX } from "@tabler/icons-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api"
import { useChatPanel, type ChatSubject } from "./chat-panel-context"
import { ChatInput } from "./chat-input"
import { ChatMessages } from "./chat-messages"
import { useCreateChat, useSubjectChats } from "@/hooks/use-chats"

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8787"

const SUGGESTIONS: Record<ChatSubject["type"], string[]> = {
  screening: [
    "Is this vessel sanctioned, and who owns it?",
    "Summarise the risk verdict and top drivers.",
    "Any concerning AIS behaviour?",
  ],
  project: [
    "Is this counterparty sanctioned?",
    "Walk me through the corporate network.",
    "What's the recommended action and why?",
  ],
}

export function ChatPanel() {
  const { subject, close } = useChatPanel()

  if (!subject) return null

  return (
    <div className="flex h-full flex-col bg-background duration-200 animate-in fade-in slide-in-from-right-6">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold">{subject.name}</span>
          <span className="text-xs text-muted-foreground">
            {subject.type === "screening" ? "Screening" : "Counterparty DD"} · Agent
          </span>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Close chat" onClick={close}>
          <IconX className="size-4" />
        </Button>
      </header>

      {/* Keyed by subject so switching subjects loads that subject's chat. */}
      <ChatSession key={`${subject.type}:${subject.id}`} subject={subject} />
    </div>
  )
}

function toUIMessages(
  rows: { id: string; role: string; parts: unknown; createdAt?: string }[],
): UIMessage[] {
  return rows.map((r) => ({
    id: r.id,
    role: r.role as UIMessage["role"],
    parts: r.parts as UIMessage["parts"],
    metadata: r.createdAt ? { createdAt: r.createdAt } : undefined,
  }))
}

function ChatSession({ subject }: { subject: ChatSubject }) {
  // One chat per subject. Wait for the lookup to settle before mounting the
  // thread so it knows definitively whether a chat already exists (avoids a
  // race where an existing chat is missed and a new one gets created).
  const { data: chats, isLoading } = useSubjectChats(subject.type, subject.id)

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return <ChatThread subject={subject} initialChatId={chats?.[0]?.id ?? null} />
}

function ChatThread({ subject, initialChatId }: { subject: ChatSubject; initialChatId: string | null }) {
  const createChat = useCreateChat()
  // Frozen at mount from the settled lookup. A later refetch (e.g. after the
  // first message creates the chat) must NOT change this — otherwise the live
  // conversation would reload/reset.
  const [chatId] = useState(initialChatId)
  const chatIdRef = useRef<string | null>(initialChatId)

  const [transport] = useState(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: `${API_BASE}/api/chats/pending/stream`,
        credentials: "include",
        // For a brand-new chat the id is only known after first-send creation,
        // so resolve the URL per request from the ref.
        prepareSendMessagesRequest: ({ messages }) => ({
          api: `${API_BASE}/api/chats/${chatIdRef.current}/stream`,
          credentials: "include",
          body: { messages },
        }),
      }),
  )

  const { messages, sendMessage, stop, status, setMessages } = useChat({ transport })

  // Load the existing chat's history once, on mount.
  useEffect(() => {
    if (!chatId) return
    let cancelled = false
    apiFetch<{ messages: { id: string; role: string; parts: unknown; createdAt?: string }[] }>(
      `/api/chats/${chatId}`,
    )
      .then((data) => {
        if (!cancelled) setMessages(toUIMessages(data.messages))
      })
      .catch(() => {
        if (!cancelled) toast.error("Couldn't load this chat")
      })
    return () => {
      cancelled = true
    }
  }, [chatId, setMessages])

  const handleSend = async (text: string) => {
    try {
      if (!chatIdRef.current) {
        const chat = await createChat.mutateAsync({ subjectType: subject.type, subjectId: subject.id })
        chatIdRef.current = chat.id
      }
      sendMessage({ text, metadata: { createdAt: new Date().toISOString() } })
    } catch {
      toast.error("Couldn't start the chat")
    }
  }

  return (
    <>
      <ChatMessages
        messages={messages}
        status={status}
        suggestions={messages.length === 0 ? SUGGESTIONS[subject.type] : undefined}
        onSuggestion={handleSend}
      />
      <ChatInput onSend={handleSend} onStop={stop} status={status} />
    </>
  )
}
