import { DEFAULT_BASE_URL, DEFAULT_USER_AGENT } from "./constants"
import {
  companyById,
  companyByName,
  companyFleetByImo,
  shipByImo,
  shipHistoryByImo,
  shipInspectionsByImo,
} from "./endpoints"
import type { EquasisRequest } from "./endpoints"
import { scrapePage } from "./http"
import { extractCompanyResults } from "./parse/company"
import { extractCompanyFleet } from "./parse/companyFleet"
import { extractShipHistory } from "./parse/history"
import { extractShipInspections } from "./parse/inspection"
import { extractShipInfo } from "./parse/ship"
import { EquasisSession } from "./session"
import type { CompanyFleet, CompanyResult, ShipHistory, ShipInfo, ShipInspections } from "./types"

export interface EquasisClientConfig {
  email: string
  password: string
  /** Defaults to the public Equasis instance. */
  baseUrl?: string
  userAgent?: string
  /** Minimum gap between outgoing requests (politeness throttle). Default 1000ms. */
  minRequestIntervalMs?: number
}

/**
 * High-level Equasis client. Each method composes a request builder, the network
 * seam ({@link scrapePage}), and a pure parser. Calls are serialized and throttled
 * so a burst of job handlers can share one client without hammering Equasis.
 */
export class EquasisClient {
  private readonly session: EquasisSession
  private readonly minRequestIntervalMs: number
  private chain: Promise<unknown> = Promise.resolve()
  private lastRequestAt = 0

  constructor(config: EquasisClientConfig) {
    this.session = new EquasisSession({
      email: config.email,
      password: config.password,
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
      userAgent: config.userAgent ?? DEFAULT_USER_AGENT,
    })
    this.minRequestIntervalMs = config.minRequestIntervalMs ?? 1000
  }

  /** Look up a vessel by IMO — particulars, compliance overview, ownership chain, and recent geographical sightings. */
  async getShipByImo(imo: string): Promise<ShipInfo> {
    const html = await this.request(shipByImo(imo))
    return extractShipInfo(html, imo)
  }

  /** Fetch a vessel's port-state-control (PSC) inspection history by IMO. */
  async getShipInspections(imo: string): Promise<ShipInspections> {
    const html = await this.request(shipInspectionsByImo(imo))
    return extractShipInspections(html, imo)
  }

  /** Fetch a vessel's name/flag/owner/manager change history by IMO. */
  async getShipHistory(imo: string): Promise<ShipHistory> {
    const html = await this.request(shipHistoryByImo(imo))
    return extractShipHistory(html, imo)
  }

  /** Search companies by (partial) name. */
  async searchCompaniesByName(name: string): Promise<CompanyResult[]> {
    const html = await this.request(companyByName(name))
    return extractCompanyResults(html)
  }

  /** Search companies by Equasis company number / id. */
  async searchCompaniesById(id: string): Promise<CompanyResult[]> {
    const html = await this.request(companyById(id))
    return extractCompanyResults(html)
  }

  /** List a company's fleet (the vessels it owns/manages) by Equasis company number. */
  async getCompanyFleet(companyImo: string): Promise<CompanyFleet> {
    const html = await this.request(companyFleetByImo(companyImo))
    return extractCompanyFleet(html, companyImo)
  }

  /** Serialize + throttle network calls so one client stays polite under load. */
  private request(req: EquasisRequest): Promise<string> {
    const result = this.chain.then(async () => {
      const wait = this.minRequestIntervalMs - (Date.now() - this.lastRequestAt)
      if (wait > 0) {
        await delay(wait)
      }
      this.lastRequestAt = Date.now()
      return scrapePage(this.session, req)
    })
    // Keep the throttle chain alive regardless of this request's outcome.
    this.chain = result.then(noop, noop)
    return result
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function noop(): void {
  /* swallow — used only to keep the serialization chain from rejecting */
}
