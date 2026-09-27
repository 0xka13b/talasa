import {
  DEFAULT_ALGORITHM,
  DEFAULT_BASE_URL,
  DEFAULT_CUTOFF,
  DEFAULT_DATASET,
  DEFAULT_LIMIT,
  DEFAULT_THRESHOLD,
} from "./constants"
import { targetToExample } from "./entity"
import type { EntityExample } from "./entity"
import { OpenSanctionsConfigError } from "./errors"
import { getEntityById, postMatch } from "./http"
import type { TransportConfig } from "./http"
import { buildScreeningResult, worstDecision } from "./screen"
import type {
  CompanyTarget,
  CounterpartyScreening,
  EntityDetail,
  PersonTarget,
  ScreenTarget,
  ScreeningResult,
  VesselTarget,
} from "./types"

export interface OpenSanctionsClientConfig {
  /** Required by the hosted API; a self-hosted yente needs none (blank = no auth header). */
  apiKey: string
  /** Hosted API by default; point at a self-hosted yente (e.g. http://localhost:8000). */
  baseUrl?: string
  /** Collection to scope to. Default `default` (sanctions + watchlists + PEPs). */
  dataset?: string
  /** Matching algorithm. Default `logic-v2` (pinned for reproducible scores). */
  algorithm?: string
  threshold?: number
  cutoff?: number
  limit?: number
}

/**
 * Thin, typed client over the OpenSanctions matching API — the hosted service or
 * a self-hosted yente (same /match + /entities surface). Methods return
 * domain {@link ScreeningResult}s (decision + matches), not raw API payloads.
 */
export class OpenSanctionsClient {
  private readonly config: TransportConfig

  constructor(config: OpenSanctionsClientConfig) {
    const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL
    if (!config.apiKey && new URL(baseUrl).host === new URL(DEFAULT_BASE_URL).host) {
      throw new OpenSanctionsConfigError("apiKey is required for the hosted API")
    }
    this.config = {
      apiKey: config.apiKey,
      baseUrl,
      dataset: config.dataset ?? DEFAULT_DATASET,
      algorithm: config.algorithm ?? DEFAULT_ALGORITHM,
      threshold: config.threshold ?? DEFAULT_THRESHOLD,
      cutoff: config.cutoff ?? DEFAULT_CUTOFF,
      limit: config.limit ?? DEFAULT_LIMIT,
    }
  }

  /** Screen many targets in one batched /match call; results align to input order. */
  async screen(targets: ScreenTarget[]): Promise<ScreeningResult[]> {
    if (targets.length === 0) {
      return []
    }
    const queries: Record<string, EntityExample> = {}
    targets.forEach((target, index) => {
      queries[queryKey(index)] = targetToExample(target)
    })
    const response = await postMatch(this.config, queries)
    return targets.map((target, index) =>
      buildScreeningResult(target, response.responses[queryKey(index)]?.results ?? []),
    )
  }

  async screenVessel(target: Omit<VesselTarget, "kind">): Promise<ScreeningResult> {
    return this.screenOne({ kind: "vessel", ...target })
  }

  async screenCompany(target: Omit<CompanyTarget, "kind">): Promise<ScreeningResult> {
    return this.screenOne({ kind: "company", ...target })
  }

  async screenPerson(target: Omit<PersonTarget, "kind">): Promise<ScreeningResult> {
    return this.screenOne({ kind: "person", ...target })
  }

  /**
   * Screen a whole counterparty — the vessel plus its ownership chain (the entities
   * Equasis returns) — in one batched call, rolled up to an overall decision.
   */
  async screenCounterparty(input: {
    vessel?: Omit<VesselTarget, "kind">
    companies?: Omit<CompanyTarget, "kind">[]
    persons?: Omit<PersonTarget, "kind">[]
  }): Promise<CounterpartyScreening> {
    const targets: ScreenTarget[] = []
    if (input.vessel) {
      targets.push({ kind: "vessel", ...input.vessel })
    }
    for (const company of input.companies ?? []) {
      targets.push({ kind: "company", ...company })
    }
    for (const person of input.persons ?? []) {
      targets.push({ kind: "person", ...person })
    }
    const results = await this.screen(targets)
    return { overall: worstDecision(results.map((result) => result.decision)), results }
  }

  /** Fetch a full entity record to drill down on a match. */
  async getEntity(id: string): Promise<EntityDetail> {
    return getEntityById(this.config, id)
  }

  private async screenOne(target: ScreenTarget): Promise<ScreeningResult> {
    const [result] = await this.screen([target])
    return result ?? buildScreeningResult(target, [])
  }
}

function queryKey(index: number): string {
  return `q${index}`
}
