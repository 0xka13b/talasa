/**
 * Poll-loop worker: drives both queues (counterparty `projects` + vessel
 * `screenings`) per tick, sleeps when both are idle.
 * Responds to SIGINT / SIGTERM for graceful shutdown.
 */

import { db as defaultDb } from "@talasa/db"
import type { Clients } from "./clients"
import type { Logger } from "./log"
import { runQueue } from "./pipeline/queue"
import { counterpartyPipeline } from "./pipeline/run"
import { vesselPipeline } from "./pipeline/vessel/pipeline"
import { tickScheduler } from "./pipeline/scheduler"

const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 2000)
function sleep(ms: number) { return new Promise<void>((resolve) => setTimeout(resolve, ms)) }

export async function startWorker(c: Clients, log: Logger): Promise<void> {
  let running = true
  function stop() { log.info("worker shutting down"); running = false }
  process.on("SIGINT", stop)
  process.on("SIGTERM", stop)
  log.info({ pollMs: POLL_MS }, "worker started")

  while (running) {
    try {
      // Promote any due monitors to queued screenings, then drain the queues.
      const scheduled = await tickScheduler(log, defaultDb)
      const workedCp = await runQueue(counterpartyPipeline, c, log, defaultDb)
      const workedVessel = await runQueue(vesselPipeline, c, log, defaultDb)
      if (!scheduled && !workedCp && !workedVessel && running) await sleep(POLL_MS)
    } catch (err) {
      log.error({ err }, "unexpected worker error — sleeping before retry")
      await sleep(POLL_MS)
    }
  }
  log.info("worker stopped")
}
