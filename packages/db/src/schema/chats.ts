import { bigint, index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth"

export const chatSubjectType = pgEnum("chat_subject_type", ["screening", "project"])

// A chat is always scoped to exactly one subject (a vessel screening or a
// counterparty DD project). No general/global chats.
export const chats = pgTable("chats", {
  id: uuid("id").primaryKey().defaultRandom(),
  subjectType: chatSubjectType("subject_type").notNull(),
  subjectId: uuid("subject_id").notNull(),
  // Derived from the first user message; null until the first turn is saved.
  title: text("title"),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

// One row per role turn. `parts` holds the AI SDK UIMessage part array
// (text + tool parts); `convertToModelMessages` reconstructs wire messages.
// Ordering is by `seq` (identity), never createdAt (ties / clock skew).
export const messages = pgTable(
  "messages",
  {
    // Message ids come from the AI SDK (non-UUID strings), so this is text.
    id: text("id").primaryKey(),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    seq: bigint("seq", { mode: "number" }).notNull().generatedByDefaultAsIdentity(),
    role: text("role").$type<"user" | "assistant">().notNull(),
    parts: jsonb("parts").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_chat_seq_idx").on(t.chatId, t.seq)],
)
