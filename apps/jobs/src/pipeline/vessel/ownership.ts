import type { ManagementEntry } from "@talasa/equasis"
import type { InferredOwnership, UndisclosedOwnershipFlag, VesselIdentity, VesselSanctionMatch } from "@talasa/shared"
import type { InferenceClient } from "@talasa/inference"

/** Management roles whose disclosure we care about (same set identify seeds on). */
const MANAGEMENT_ROLE = /(registered owner|registered manager|ism manager|commercial manager|manager)/i

/**
 * Placeholder ownership values Equasis reports in place of a real company when
 * the interest behind a role is concealed — the tell-tale being "UNKNOWN" or
 * "RPTD SOLD UNDISCLOSED INTEREST" (reported sold to an undisclosed interest),
 * plus the usual "not disclosed / not reported / n/a" variants.
 */
const UNDISCLOSED_RE = /\b(unknown|undisclosed|rptd\s+sold|reported\s+sold|not\s+(?:known|disclosed|reported|available)|n\/?a)\b/i

/** A cleaner role label than {@link canonicalRole}, keeping registered-vs-commercial. */
function roleLabel(raw: string): string {
  const r = raw.toLowerCase()
  if (r.includes("registered owner")) return "Registered owner"
  if (r.includes("registered manager")) return "Registered manager"
  if (r.includes("ism")) return "ISM Manager"
  if (r.includes("commercial")) return "Commercial Manager"
  return raw.trim() || "Manager"
}

/**
 * Scan the RAW Equasis management rows (before the identify stage drops rows
 * without a company IMO) for undisclosed/unknown ownership placeholders. These
 * never carry a company IMO, so they would otherwise vanish from the screening.
 */
export function detectUndisclosedOwnership(management: ManagementEntry[]): UndisclosedOwnershipFlag[] {
  const flags: UndisclosedOwnershipFlag[] = []
  const seen = new Set<string>()
  for (const m of management) {
    if (!MANAGEMENT_ROLE.test(m.role)) continue
    const placeholder = m.name.trim()
    if (!placeholder || !UNDISCLOSED_RE.test(placeholder)) continue
    const role = roleLabel(m.role)
    const key = `${role}|${placeholder.toUpperCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    flags.push({ role, placeholder })
  }
  return flags
}

type StageLog = { warn: (obj: unknown, msg?: string) => void }

/**
 * OPTIONAL ownership-inference step. Runs only when a concealment placeholder is
 * present. It never overrides the registry `companies` data — it produces a
 * separate, clearly-labelled hypothesis built from the sanctions-list narrative
 * evidence already gathered. Returns `null` when there is nothing to flag, and
 * degrades to flags-only (empty `entities`) when no narrative exists or the
 * inference call fails — so the concealment flag itself is never lost.
 */
export async function screenOwnership(
  flags: UndisclosedOwnershipFlag[],
  identity: VesselIdentity,
  matches: VesselSanctionMatch[],
  c: { inference: InferenceClient },
  log?: StageLog,
): Promise<InferredOwnership | null> {
  if (flags.length === 0) return null
  const generatedAt = new Date().toISOString()
  const flagsOnly = (summary: string): InferredOwnership => ({ flags, entities: [], summary, generatedAt })

  // Every sanctions/POI match that carries a designation narrative or notes is
  // fair game — the subject vessel's own POI description is usually the richest.
  const evidence = matches
    .map((m) => {
      const text = [m.description, ...(m.notes ?? [])].filter(Boolean).join(" ").trim()
      return text ? { entity: m.entity, list: m.datasets?.[0] ?? m.list, text } : null
    })
    .filter((e): e is { entity: string; list: string; text: string } => e !== null)

  if (evidence.length === 0) {
    return flagsOnly("Registry ownership is undisclosed and no sanctions-list narrative was available to infer the network behind it.")
  }

  try {
    const { fields } = await c.inference.inferOwnership({
      subject: { imo: identity.imo, name: identity.name, flag: identity.flag, type: identity.type },
      undisclosed: flags,
      evidence,
    })
    return { flags, entities: fields.entities, summary: fields.summary, generatedAt }
  } catch (err) {
    log?.warn({ err: err instanceof Error ? err.message : String(err) }, "ownership inference failed — keeping the concealment flag only")
    return flagsOnly("Registry ownership is undisclosed; the inference step could not be completed.")
  }
}
