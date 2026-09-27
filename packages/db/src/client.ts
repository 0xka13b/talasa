import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { account, chats, chatSubjectType, messages, projects, projectStatus, sarVerifications, screenings, session, user, verification } from "./schema"

const schema = { user, session, account, verification, projects, projectStatus, screenings, sarVerifications, chats, chatSubjectType, messages }

export function createDb(url: string) {
  return drizzle(postgres(url), { schema })
}

export const db = createDb(process.env.DATABASE_URL!)
