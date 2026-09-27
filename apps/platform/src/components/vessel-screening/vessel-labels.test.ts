import { describe, it, expect } from "vitest"
import {
  humanizeToken,
  formatSanctionsList,
  formatDriver,
  formatSanctionsStatus,
} from "./vessel-labels"

describe("humanizeToken", () => {
  it("humanizes snake_case", () => {
    expect(humanizeToken("sister_sanction")).toBe("Sister sanction")
    expect(humanizeToken("risky_flag")).toBe("Risky flag")
  })
  it("keeps acronyms uppercase", () => {
    expect(humanizeToken("imo")).toBe("IMO")
    expect(humanizeToken("mmsi")).toBe("MMSI")
  })
  it("splits camelCase", () => {
    expect(humanizeToken("yearBuilt")).toBe("Year built")
  })
})

describe("formatSanctionsList", () => {
  it("maps known dataset ids to curated names", () => {
    expect(formatSanctionsList("ca_dfatd_sema_sanctions")).toBe("Canada SEMA Sanctions")
    expect(formatSanctionsList("us_ofac_sdn")).toBe("OFAC SDN (US)")
  })
  it("falls back to a humanized label for unknown codes (acronyms kept uppercase)", () => {
    expect(formatSanctionsList("au_random_list")).toBe("AU random list")
  })
})

describe("formatDriver", () => {
  it("renders a dotted category path readably", () => {
    expect(formatDriver("fleet.sister_sanctioned")).toBe("Fleet — Sister sanctioned")
    expect(formatDriver("flag.high_risk")).toBe("Flag — High risk")
  })
  it("humanizes a flat driver", () => {
    expect(formatDriver("subject_hit")).toBe("Subject hit")
  })
})

describe("formatSanctionsStatus", () => {
  it("maps statuses to labels", () => {
    expect(formatSanctionsStatus("NO_MATCH")).toBe("No match")
    expect(formatSanctionsStatus("CONFIRMED")).toBe("Confirmed")
  })
})
