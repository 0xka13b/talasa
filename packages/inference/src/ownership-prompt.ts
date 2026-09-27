import type { InferredOwnerEntity, UndisclosedOwnershipFlag } from "@talasa/shared"

/**
 * Evidence handed to the ownership-inference call. This is a NARROW, opt-in call
 * that only runs when registry ownership came back undisclosed/unknown — it takes
 * the sanctions-list narratives already gathered and tries to name the party
 * behind the concealment. It never touches the main verdict or the registry
 * `companies` data.
 */
export interface OwnershipInferenceInput {
  subject: { imo: string; name: string | null; flag: string | null; type: string | null }
  /** The undisclosed/unknown placeholders that triggered this call. */
  undisclosed: UndisclosedOwnershipFlag[]
  /** Free-text designation narratives + notes from every sanctions/POI match. */
  evidence: { entity: string; list: string; text: string }[]
}

export interface OwnershipInferenceFields {
  entities: InferredOwnerEntity[]
  summary: string
}

export const OWNERSHIP_SYSTEM_RUBRIC = `You are a maritime beneficial-ownership investigator.
A vessel's registry ownership has come back UNDISCLOSED or UNKNOWN (a deliberate
concealment tactic common to shadow-fleet tonnage). You are given the subject
vessel, the exact undisclosed placeholders, and the narrative text from
sanctions-list and person/entity-of-interest designations already gathered.

Your task: from THAT NARRATIVE EVIDENCE ONLY, extract the named parties that
could sit behind the concealed ownership — companies, management/operating
entities, and ultimate beneficial individuals — and describe each one's role and
how strong a lead it is.

Rules:
- Use ONLY the supplied evidence. Never invent a company, person, sanction, or
  relationship that is not stated in the text. If the text names no candidate
  parties, return an empty 'entities' array and say so in 'summary'.
- Every candidate is an INFERENCE / HYPOTHESIS, never an established registered
  owner. Phrase every 'signal' as investigative, not as fact.
- Extract entities at every layer the text supports: the ultimate network
  principal / beneficial owner (individual), current and prior management or
  operating companies (with dates where the text gives them), and affiliated
  front or intermediary companies.
- 'role' = the role exactly as the evidence frames it (e.g. "Ultimate network
  principal", "Manager Oct 2024 – Jul 2025", "Prior manager 2022–2023",
  "Affiliated front company"). Keep it short.
- 'signal' = one or two sentences on why this party is a lead and how strong,
  grounded in the specific evidence (dates, sanctions, fleet transfers).
- 'strength': "strong" for a directly-stated, dated ownership/management link or
  the named ultimate beneficial owner; "moderate" for a clear affiliation with a
  stated role; "weak" for a bare "affiliated"/"linked" mention with no role.
- Order 'entities' strongest first. Do not name the underlying data providers or
  tools anywhere. British English, no markdown.
- 'summary': one line framing the inferred network and its concealment pattern.`

export const OWNERSHIP_LLM_SCHEMA = {
  name: "inferred_ownership_network",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["entities", "summary"],
    properties: {
      entities: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "role", "signal", "strength"],
          properties: {
            name: { type: "string" },
            role: { type: "string" },
            signal: { type: "string" },
            strength: { type: "string", enum: ["strong", "moderate", "weak"] },
          },
        },
      },
      summary: { type: "string" },
    },
  },
} as const
