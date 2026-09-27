import type { Decision, RiskBand, RiskScore } from "./dd.js"

export interface ScoreInput {
  sanctionsStatus: "NO_MATCH" | "POSSIBLE" | "CONFIRMED"
  sanctionMatchCount: number
  detentionCount: number
  unresolvedBeneficialOwner: boolean
}

const CONFIRMED_FLOOR = 70

export function computeRiskScore(input: ScoreInput): RiskScore {
  const drivers: string[] = []
  let value = 0

  if (input.sanctionsStatus === "CONFIRMED") {
    value += 60
    drivers.push("sanctions.confirmed")
  } else if (input.sanctionsStatus === "POSSIBLE") {
    value += 20
    drivers.push("sanctions.possible")
  }

  const detentions = Math.min(input.detentionCount * 10, 30)
  if (detentions > 0) { value += detentions; drivers.push("psc.detentions") }

  if (input.unresolvedBeneficialOwner) { value += 5; drivers.push("ownership.beneficial_unresolved") }

  if (input.sanctionsStatus === "CONFIRMED") value = Math.max(value, CONFIRMED_FLOOR)
  value = Math.min(value, 100)

  return { value, band: band(value), drivers }
}

function band(value: number): RiskBand {
  if (value >= 70) return "REJECT"
  if (value >= 40) return "ENHANCED_DD"
  return "CLEAR"
}

export function decideAction(score: RiskScore, sanctionsStatus: ScoreInput["sanctionsStatus"]): Decision {
  if (sanctionsStatus === "CONFIRMED") return "REJECT"
  return score.band
}
