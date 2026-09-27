import { describe, it, expect } from "vitest"
import type { AisEvent } from "@talasa/shared"
import { mappableEvents, eventDetail, shortUtc, locationLabel, locationOneLine, KIND_LABEL, KIND_COLOR } from "./ais-map"

function ev(partial: Partial<AisEvent>): AisEvent {
  return {
    kind: "dark_gap",
    startUtc: null,
    endUtc: null,
    durationHours: null,
    distanceNm: null,
    impliedSpeedKn: null,
    lat: null,
    lon: null,
    highRiskArea: null,
    place: null,
    ...partial,
  }
}

describe("mappableEvents", () => {
  it("keeps only events with both coordinates", () => {
    const events = [
      ev({ kind: "dark_gap", lat: 8.4, lon: -13.2 }),
      ev({ kind: "speed_anomaly", lat: null, lon: null }),
      ev({ kind: "sts_candidate", lat: 5.5, lon: 1.2 }),
    ]
    const points = mappableEvents(events)
    expect(points).toHaveLength(2)
    expect(points.map((p) => p.kind)).toEqual(["dark_gap", "sts_candidate"])
    expect(points.every((p) => typeof p.lat === "number" && typeof p.lon === "number")).toBe(true)
  })
})

describe("eventDetail", () => {
  it("summarises a dark gap with duration + distance + implied speed", () => {
    expect(eventDetail(ev({ kind: "dark_gap", durationHours: 11.57, distanceNm: 137.28, impliedSpeedKn: 11.87 }))).toBe(
      "11.57h · 137.28 nm gap · 11.87 kn implied",
    )
  })
  it("omits the gap distance for non-dark-gap kinds", () => {
    expect(eventDetail(ev({ kind: "sts_candidate", durationHours: 9.2 }))).toBe("9.2h")
  })
  it("returns an empty string when there's nothing to show", () => {
    expect(eventDetail(ev({ kind: "speed_anomaly" }))).toBe("")
  })
})

describe("shortUtc", () => {
  it("formats an ISO timestamp to date + HH:MM", () => {
    expect(shortUtc("2026-06-05T06:43:00Z")).toBe("2026-06-05 06:43")
  })
  it("returns an em dash for null", () => {
    expect(shortUtc(null)).toBe("—")
  })
})

const MARITIME = {
  nearestPort: "Freetown, Sierra Leone",
  distanceNm: 16,
  bearing: "W",
  sea: "North Atlantic Ocean",
  eez: "Sierra Leone EEZ (approx)",
}

describe("locationLabel", () => {
  it("prefers the Google place, adds the sea as context, omits EEZ when place names the country", () => {
    const e = ev({ place: "Freetown, Sierra Leone", lat: 8.5, lon: -13.2, maritime: MARITIME })
    expect(locationLabel(e)).toEqual({ primary: "Freetown, Sierra Leone", secondary: "North Atlantic Ocean" })
  })

  it("falls back to the maritime port phrase + sea + EEZ for open water", () => {
    const e = ev({ place: null, lat: 8.44, lon: -13.47, maritime: MARITIME })
    expect(locationLabel(e)).toEqual({
      primary: "16 nm W of Freetown, Sierra Leone",
      secondary: "North Atlantic Ocean · Sierra Leone EEZ (approx)",
    })
  })

  it("falls back to raw coordinates when nothing resolved", () => {
    const e = ev({ place: null, lat: 8.44662, lon: -13.469275, maritime: null })
    expect(locationLabel(e)).toEqual({ primary: "8.447, -13.469", secondary: null })
  })

  it("composes a one-line label", () => {
    const e = ev({ place: null, lat: 8.44, lon: -13.47, maritime: MARITIME })
    expect(locationOneLine(e)).toBe("16 nm W of Freetown, Sierra Leone · North Atlantic Ocean · Sierra Leone EEZ (approx)")
  })
})

describe("kind maps", () => {
  it("has a label and colour for every event kind", () => {
    for (const kind of ["dark_gap", "sts_candidate", "speed_anomaly"] as const) {
      expect(KIND_LABEL[kind]).toBeTruthy()
      expect(KIND_COLOR[kind]).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})
