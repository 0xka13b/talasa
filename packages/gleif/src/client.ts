import {
  DEFAULT_BASE_URL,
  DEFAULT_FUZZY_LIMIT,
  DEFAULT_MIN_REQUEST_INTERVAL_MS,
  DEFAULT_TIMEOUT_MS,
} from "./constants"
import { fuzzyByName, getLeiRecord, getParentRecord } from "./http"
import type { TransportConfig } from "./http"
import { mapFuzzyMatches, mapLeiRecord, matchConfidence, normalizeName, toOwnershipLink } from "./map"
import { Throttle } from "./throttle"
import type { GleifCompany, GleifCompanyProfile, GleifNameMatch } from "./types"

export interface GleifClientConfig {
  baseUrl?: string
  timeoutMs?: number
  /** Minimum gap between requests (GLEIF allows 60/min). Default 1000ms. */
  minRequestIntervalMs?: number
}

/**
 * Thin, typed client over GLEIF's open JSON:API. Returns trimmed domain objects
 * (verification + parent ownership), not raw payloads. Requests are serialized
 * through an internal throttle to respect the 60 req/min cap.
 */
export class GleifClient {
  private readonly transport: TransportConfig
  private readonly throttle: Throttle

  constructor(config: GleifClientConfig = {}) {
    this.transport = {
      baseUrl: (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    }
    this.throttle = new Throttle(config.minRequestIntervalMs ?? DEFAULT_MIN_REQUEST_INTERVAL_MS)
  }

  /** Match a company name to candidate LEIs (exact legal-name matches first). */
  async searchByName(name: string, opts: { limit?: number } = {}): Promise<GleifNameMatch[]> {
    if (!name.trim()) {
      return []
    }
    const matches = await this.throttle.run(() =>
      fuzzyByName(this.transport, name, opts.limit ?? DEFAULT_FUZZY_LIMIT),
    )
    // The name-search returns records in relevance order; promote an exact
    // normalized legal-name match to the front so lookupCompany picks it.
    const q = normalizeName(name)
    return mapFuzzyMatches(matches).sort(
      (a, b) => Number(normalizeName(b.value) === q) - Number(normalizeName(a.value) === q),
    )
  }

  /** Full verification record for an LEI, or null if unknown. */
  async getRecord(lei: string): Promise<GleifCompany | null> {
    const rec = await this.throttle.run(() => getLeiRecord(this.transport, lei))
    return rec ? mapLeiRecord(rec) : null
  }

  async getDirectParent(lei: string): Promise<GleifCompany | null> {
    return this.getParent(lei, "direct")
  }

  async getUltimateParent(lei: string): Promise<GleifCompany | null> {
    return this.getParent(lei, "ultimate")
  }

  /**
   * Resolve a company name to a full profile: best fuzzy match -> verification
   * record -> (optional) direct + ultimate parent. Returns null if nothing matches.
   */
  async lookupCompany(
    name: string,
    opts: { includeOwnership?: boolean } = {},
  ): Promise<GleifCompanyProfile | null> {
    const matches = await this.searchByName(name)
    const best = matches[0]
    if (!best) {
      return null
    }
    const company = await this.getRecord(best.lei)
    if (!company) {
      return null
    }

    let directParent: GleifCompanyProfile["directParent"] = null
    let ultimateParent: GleifCompanyProfile["ultimateParent"] = null
    if (opts.includeOwnership !== false) {
      const direct = await this.getDirectParent(best.lei)
      const ultimate = await this.getUltimateParent(best.lei)
      directParent = direct ? toOwnershipLink(direct, "IS_DIRECTLY_CONSOLIDATED_BY") : null
      ultimateParent = ultimate ? toOwnershipLink(ultimate, "IS_ULTIMATELY_CONSOLIDATED_BY") : null
    }

    return {
      query: name,
      match: { value: best.value, confidence: matchConfidence(name, best.value) },
      company,
      directParent,
      ultimateParent,
    }
  }

  private async getParent(lei: string, kind: "direct" | "ultimate"): Promise<GleifCompany | null> {
    const rec = await this.throttle.run(() => getParentRecord(this.transport, lei, kind))
    return rec ? mapLeiRecord(rec) : null
  }
}
