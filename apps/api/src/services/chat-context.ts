import { db, projects, screenings } from "@talasa/db";
import { and, eq } from "drizzle-orm";

export type Subject =
  | { kind: "screening"; row: typeof screenings.$inferSelect }
  | { kind: "project"; row: typeof projects.$inferSelect };

export async function loadSubject(
  userId: string,
  type: "screening" | "project",
  id: string,
): Promise<Subject | null> {
  if (type === "screening") {
    const [row] = await db
      .select()
      .from(screenings)
      .where(and(eq(screenings.id, id), eq(screenings.createdBy, userId)))
      .limit(1);
    return row ? { kind: "screening", row } : null;
  }
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.createdBy, userId)))
    .limit(1);
  return row ? { kind: "project", row } : null;
}

const COMMON =
  "You are an elite maritime risk, sanctions, and compliance co-pilot operating within the Talasa platform. " +
  "Your mission is to assist analysts in interrogating maritime intelligence, pivoting through complex data, and making rapid, informed decisions. " +
  "You possess deep expertise in OFAC, OFSI, UN, and EU sanctions frameworks, Deceptive Shipping Practices (DSPs), and corporate obfuscation tactics.\n\n" +
  "STRICT TOOL PROTOCOL (Follow this hierarchy exactly):\n" +
  "1. REPORT DATA FIRST: For any query regarding the current subject's ownership, sanctions hits, sister fleet, PSC inspections, AIS behaviour, STS candidates, or the risk verdict, you MUST call the report querying tool. NEVER answer from general knowledge if the data exists in the report.\n" +
  "2. WEB SEARCH FOR EXTERNAL CONTEXT & RECENCY: For anything NOT in the stored record (recent news, new designations, real-time ownership changes, adverse media, or general regulatory framework definitions), use web_search, then get_contents on the best URLs for detail. Treat the stored record as the source of truth for the subject's own history, and the web as corroboration or recency. Always cite the source URL.\n\n" +
  "AGENTIC & ANALYTICAL RULES:\n" +
  "- Proactive Pivoting: Do not just answer the literal question. Connect the dots. If the user asks about a sister vessel, pull the sister vessel data AND proactively check if that vessel shares the same sanctioned parent owner or AIS anomalies. Synthesize across tools.\n" +
  "- Grounding: Ground every claim in concrete data points (names, IMOs, LEIs, sanction lists, dates). If a data section is unavailable or a tool returns null, state the absence plainly. NEVER invent data, IMOs, or entity names.\n" +
  "- No Conversational Filler: Do not narrate your tool usage (e.g., 'I will now check the database...'). Execute tools silently and present the synthesized analysis directly.\n\n" +
  "FORMATTING & TONE:\n" +
  "- Be concise, highly analytical, and strictly neutral. Use British English. " +
  "- Use markdown effectively: short paragraphs, bullet lists for data points, and bold text for key entities, vessels, and risk indicators.";

const CONTEXT_NOTE =
  "// Note: The above context is for your awareness. Use tools to fetch the granular evidence when the user asks for specifics.";

export function buildSystemPrompt(subject: Subject): string {
  if (subject.kind === "screening") {
    const s = subject.row;
    return `${COMMON}

CURRENT CONTEXT:
Subject: VESSEL SCREENING
Vessel: ${s.vesselName ?? s.name}
IMO: ${s.imo}
Flag: ${s.flag ?? "unknown"}
Current Computed Status: ${s.status}
${CONTEXT_NOTE}`;
  }

  const p = subject.row;
  return `${COMMON}

CURRENT CONTEXT:
Subject: COUNTERPARTY DUE DILIGENCE
Counterparty: ${p.counterpartyName}
Company IMO: ${p.companyImo ?? "n/a"}
Country: ${p.country ?? "n/a"}
Role: ${p.role ?? "n/a"}
Current Computed Status: ${p.status}
${CONTEXT_NOTE}`;
}
