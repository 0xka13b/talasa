import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"

// `onnotice` swallows Postgres NOTICEs ("schema drizzle already exists, skipping",
// etc.) that drizzle's CREATE ... IF NOT EXISTS bookkeeping emits on every re-run
// — harmless, but noisy/alarming in deploy logs.
const migrationClient = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} })
await migrate(drizzle(migrationClient), { migrationsFolder: "./drizzle" })
await migrationClient.end()
console.log("migrations applied")
