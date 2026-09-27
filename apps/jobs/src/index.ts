import { buildClients } from "./clients"
import { env } from "./env"
import { logger } from "./log"
import { startWorker } from "./worker"

startWorker(buildClients(env), logger).catch((err: unknown) => {
  logger.error({ err }, "worker fatal")
  process.exit(1)
})
