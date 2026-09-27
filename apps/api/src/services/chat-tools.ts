import { tool } from "ai"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { db, sarVerifications } from "@talasa/db"
import type { Subject } from "./chat-context"
import { analyzeStsImage } from "./sar-vision"

/* eslint-disable @typescript-eslint/no-explicit-any */

const unavailable = (reason: string) => ({ available: false as const, reason })

/** Pick the best cached SAR chip to analyse: optical (unless very cloudy), else SAR. */
function pickSarRow(rows: (typeof sarVerifications.$inferSelect)[]) {
  const withImg = rows.filter((r) => r.image)
  const usable = withImg.filter((r) => !(r.palette === "optical" && (r.cloudCover ?? 0) > 70))
  const pool = usable.length ? usable : withImg
  return ["optical", "terrain", "twopol"].map((p) => pool.find((r) => r.palette === p)).find(Boolean) ?? pool[0] ?? null
}

// ---- live web tools (Exa) ----
// These reach the open web — the rest of the toolset is confined to the stored
// brief. Ported from Aleria's web_search / get_contents / find_similar. All three
// share one keyed POST helper and a compact result shape (no raw HTML/junk).
const EXA_BASE = "https://api.exa.ai"
const EXA_CATEGORIES = ["news", "company", "pdf", "financial report", "people", "research paper", "github", "tweet", "personal site"] as const

const mapResult = (r: any) => ({
  title: r?.title ?? null,
  url: r?.url ?? null,
  publishedDate: r?.publishedDate ?? null,
  author: r?.author ?? null,
  score: r?.score ?? undefined,
  text: r?.text ?? undefined,
  highlights: r?.highlights ?? undefined,
})

/** POST to an Exa endpoint. Returns `{ results }` on success, or a structured
 * `{ error }`/`unavailable` the model can relay — never throws into the loop. */
async function exa(path: string, body: Record<string, unknown>) {
  // Read lazily from process.env (not the parsed env module) so this pure tool
  // module stays free of the env-parse side effect — keeps it unit-testable.
  const key = process.env.EXA_API_KEY
  if (!key) return unavailable("web search is not configured on this server (no EXA_API_KEY)")
  try {
    const res = await fetch(`${EXA_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      return { error: `Exa API error (${res.status})`, detail: detail.slice(0, 300) }
    }
    const data = (await res.json()) as { results?: any[] }
    return { results: (data.results ?? []).map(mapResult) }
  } catch (err) {
    return { error: "web request failed", detail: err instanceof Error ? err.message : String(err) }
  }
}

/** Subject-independent live-web tools, spread into every subject's toolset. */
function webTools() {
  return {
    web_search: tool({
      description:
        "Search the LIVE web for information not in the stored report — recent news, new sanction designations, ownership/registry changes, adverse media, incidents. Returns up to 6 brief snippets (~500 chars) + highlights. For the full text of a promising result, call get_contents on its URL; do NOT loop web_search for depth.",
      inputSchema: z.object({
        query: z.string().describe("Search query — a question, statement, or keywords."),
        category: z.enum(EXA_CATEGORIES).optional().describe("Optional content-type filter; use only when clearly relevant (e.g. 'news', 'company')."),
        includeDomains: z.array(z.string()).optional().describe("Only return results from these domains (e.g. ['ofac.treasury.gov'])."),
        excludeDomains: z.array(z.string()).optional().describe("Exclude results from these domains."),
        startPublishedDate: z.string().optional().describe("Only results published on/after this date (YYYY-MM-DD)."),
        endPublishedDate: z.string().optional().describe("Only results published on/before this date (YYYY-MM-DD)."),
      }),
      execute: async (args) => {
        const body: Record<string, unknown> = {
          query: args.query,
          numResults: 6,
          type: "auto",
          contents: { text: { maxCharacters: 500 }, highlights: { numSentences: 3, highlightsPerUrl: 3 }, livecrawl: "fallback" },
        }
        if (args.category) body.category = args.category
        if (args.includeDomains?.length) body.includeDomains = args.includeDomains
        if (args.excludeDomains?.length) body.excludeDomains = args.excludeDomains
        if (args.startPublishedDate) body.startPublishedDate = args.startPublishedDate
        if (args.endPublishedDate) body.endPublishedDate = args.endPublishedDate
        return exa("/search", body)
      },
    }),
    get_contents: tool({
      description:
        "Fetch the full extracted text of one or more web pages by URL. Use after web_search when a snippet isn't enough, or when the user pastes a URL to read.",
      inputSchema: z.object({
        urls: z.array(z.string()).min(1).describe("URLs to extract content from (ids/URLs from web_search results)."),
        maxCharacters: z.number().optional().describe("Max characters per page (default 3000)."),
      }),
      execute: async (args) =>
        exa("/contents", {
          ids: args.urls,
          text: { maxCharacters: args.maxCharacters ?? 3000 },
          highlights: { numSentences: 3, highlightsPerUrl: 3 },
          livecrawl: "preferred",
        }),
    }),
    find_similar: tool({
      description:
        "Find web pages similar to a given URL — useful for surfacing related entities, alternate registrations, or comparable companies from one starting page.",
      inputSchema: z.object({
        url: z.string().describe("The URL to find similar pages for."),
        numResults: z.number().optional().describe("How many results to return (default 5, max 100)."),
      }),
      execute: async (args) =>
        exa("/findSimilar", {
          url: args.url,
          numResults: Math.min(args.numResults ?? 5, 100),
          contents: { text: { maxCharacters: 3000 }, highlights: { numSentences: 3, highlightsPerUrl: 3 } },
        }),
    }),
  }
}

/** Graph tools shared by both subject types (the graph shape is identical). */
function graphTools(graph: any) {
  return {
    list_entities: tool({
      description:
        "List the entities (nodes) in this subject's relationship graph: id, label, kind (vessel/legal), and whether sanctioned. Use to discover ids for get_entity.",
      inputSchema: z.object({}),
      execute: async () => {
        const nodes = graph?.nodes
        if (!Array.isArray(nodes)) return unavailable("no relationship graph on this subject")
        return {
          entities: nodes.map((n: any) => ({
            id: n.id,
            label: n.label,
            kind: n.kind,
            sub: n.sub ?? null,
            sanctioned: Boolean(n.sanctioned),
            category: n.category ?? null,
            isSubject: Boolean(n.isSubject),
          })),
        }
      },
    }),
    get_entity: tool({
      description: "Get one relationship-graph entity (by id from list_entities) with its connected edges/relationships.",
      inputSchema: z.object({ id: z.string().describe("entity/node id from list_entities") }),
      execute: async ({ id }) => {
        const nodes = graph?.nodes
        const edges = graph?.edges
        if (!Array.isArray(nodes)) return unavailable("no relationship graph on this subject")
        const node = nodes.find((n: any) => n.id === id)
        if (!node) return unavailable(`no entity with id "${id}"`)
        const connected = Array.isArray(edges) ? edges.filter((e: any) => e.from === id || e.to === id) : []
        return { node, edges: connected }
      },
    }),
  }
}

export function buildTools(subject: Subject) {
  if (subject.kind === "screening") {
    const b: any = subject.row.brief ?? {}
    const graph: any = (subject.row as any).graph ?? b.graph
    return {
      get_overview: tool({
        description: "The vessel's risk verdict/score, executive summary, prediction, recommendation, and data-completeness (sources OK / gaps).",
        inputSchema: z.object({}),
        execute: async () =>
          subject.row.brief
            ? {
                verdict: b.verdict ?? null,
                executiveSummary: b.executiveSummary ?? null,
                prediction: b.prediction ?? null,
                recommendation: b.recommendation ?? null,
                dataCompleteness: b.dataCompleteness ?? null,
              }
            : unavailable("this screening has no brief yet (not completed)"),
      }),
      get_sanctions: tool({
        description: "Sanctions result for the vessel: status, whether the subject itself hit, company/sister hits, all matches, and the narrative.",
        inputSchema: z.object({}),
        execute: async () => (b.sanctions ? b.sanctions : unavailable("no sanctions section")),
      }),
      get_ownership: tool({
        description: "Companies tied to the vessel (owner/manager roles) with GLEIF LEI, jurisdiction, direct/ultimate parents, and sanctioned flags.",
        inputSchema: z.object({}),
        execute: async () => (Array.isArray(b.companies) ? { companies: b.companies } : unavailable("no companies section")),
      }),
      get_fleet: tool({
        description: "Fleet context: sister vessels and fleet companies, each with sanctioned counts.",
        inputSchema: z.object({}),
        execute: async () => (b.fleet ? b.fleet : unavailable("no fleet section")),
      }),
      get_ais_events: tool({
        description: "AIS behavioural analysis for the vessel (gaps, STS transfers, spoofing/dark-activity signals).",
        inputSchema: z.object({}),
        execute: async () => (b.ais ? b.ais : unavailable("no AIS section (AIS not run or unavailable)")),
      }),
      analyze_sts_satellite: tool({
        description:
          "Run a vision model over the persisted Sentinel satellite chip for an STS-candidate AIS event (with its AIS context) and describe what is actually visible: hull count, whether two hulls sit side-by-side, any connecting hose, the setting (open water / anchorage / port), and oil slicks. Advisory — it corroborates but does NOT override the deterministic radar verdict. Requires that 'Verify with satellite' was run for that event so a chip is cached; use get_ais_events to find the event index.",
        inputSchema: z.object({
          eventIdx: z.number().int().describe("Index into the AIS events list (get_ais_events) of the sts_candidate to analyse"),
          palette: z
            .enum(["optical", "terrain", "twopol"])
            .optional()
            .describe("Which cached layer to read; default = best available (optical unless very cloudy, else SAR)"),
        }),
        execute: async ({ eventIdx, palette }) => {
          try {
            const rows = await db
              .select()
              .from(sarVerifications)
              .where(and(eq(sarVerifications.screeningId, subject.row.id), eq(sarVerifications.eventIdx, eventIdx)))
            const row = palette ? rows.find((r) => r.palette === palette && r.image) : pickSarRow(rows)
            if (!row?.image) {
              return unavailable(
                `no ${palette ? `'${palette}' ` : ""}satellite chip cached for event ${eventIdx} — run "Verify with satellite" on that event in the report first`,
              )
            }
            const vision = await analyzeStsImage({
              row,
              event: b.ais?.events?.[eventIdx],
              imo: subject.row.imo,
              vesselName: subject.row.vesselName,
            })
            return { available: true, sensor: row.sensor, palette: row.palette, radarVerdict: row.verdict, cloudCover: row.cloudCover, vision }
          } catch (err) {
            return { error: err instanceof Error ? err.message : "vision analysis failed" }
          }
        },
      }),
      ...graphTools(graph),
      ...webTools(),
    }
  }

  const b: any = subject.row.brief ?? {}
  const graph: any = b.graph ?? (subject.row as any).graph
  return {
    get_overview: tool({
      description: "The counterparty's risk score/band, executive summary, and recommended action (decision + rationale).",
      inputSchema: z.object({}),
      execute: async () =>
        subject.row.brief
          ? {
              riskScore: b.riskScore ?? null,
              recommendedAction: b.recommendedAction ?? null,
              executiveSummary: b.executiveSummary ?? null,
              dataCompleteness: b.dataCompleteness ?? null,
            }
          : unavailable("this DD project has no brief yet (not completed)"),
    }),
    get_sanctions: tool({
      description: "Sanctions result for the counterparty and its network: status, matches (entity/list/score/tier/category), and narrative.",
      inputSchema: z.object({}),
      execute: async () => (b.sanctions ? b.sanctions : unavailable("no sanctions section")),
    }),
    get_corporate_network: tool({
      description: "The corporate network: linked companies (sharing vessels), GLEIF ownership + narrative, and affiliations (nodes/edges/narrative).",
      inputSchema: z.object({}),
      execute: async () => ({
        linkedCompanies: b.linkedCompanies ?? null,
        ownership: b.ownership ?? null,
        ownershipNarrative: b.ownershipNarrative ?? null,
        affiliations: b.affiliations ?? null,
      }),
    }),
    get_fleet: tool({
      description: "Fleet vessels linked to this counterparty (IMO, name, flag, type, sanction status).",
      inputSchema: z.object({}),
      execute: async () => (Array.isArray(b.fleet) ? { fleet: b.fleet } : unavailable("no fleet section")),
    }),
    get_incidents: tool({
      description: "PSC detentions and data/AIS gaps recorded for the counterparty's fleet.",
      inputSchema: z.object({}),
      execute: async () => (b.incidents ? b.incidents : unavailable("no incidents section")),
    }),
    ...graphTools(graph),
    ...webTools(),
  }
}
