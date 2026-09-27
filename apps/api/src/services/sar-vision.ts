import { generateObject } from "ai"
import { z } from "zod"
import type { sarVerifications } from "@talasa/db"
import type { AisEvent } from "@talasa/shared"
import { visionModel } from "./inference-provider"

/** Structured read from the vision model — advisory, never overrides the geometry. */
export const sarVisionSchema = z.object({
  hullCount: z
    .enum(["0", "1", "2", "3_plus", "unclear"])
    .describe("Distinct vessel hulls visible at the centre of the image"),
  sideBySide: z
    .enum(["yes", "no", "unclear"])
    .describe("Two hulls moored directly alongside each other (an STS configuration)?"),
  setting: z.enum(["open_water", "anchorage", "port_or_marina", "near_land", "cloud_obscured", "unclear"]),
  connectionVisible: z
    .enum(["yes", "no", "unclear"])
    .describe("Any visible hose, line or bridge between two hulls"),
  oilSlick: z.enum(["yes", "no", "unclear"]).describe("A dark oil slick / sheen on the water"),
  assessment: z.string().describe("1–3 sentences in plain language, describing ONLY what is visible"),
  confidence: z.enum(["low", "medium", "high"]),
})
export type SarVisionRead = z.infer<typeof sarVisionSchema>

type SarRow = typeof sarVerifications.$inferSelect

/** Per-palette description of what the model is looking at. */
function imageBriefing(row: SarRow): string {
  if (row.sensor === "sentinel-2") {
    return (
      "This is a Sentinel-2 OPTICAL true-colour image (like a normal photo), ~10 m per pixel" +
      (row.cloudCover != null ? `, with about ${Math.round(row.cloudCover)}% cloud cover` : "") +
      ". White/grey featureless areas are cloud, not vessels."
    )
  }
  if (row.palette === "terrain") {
    return (
      "This is a Sentinel-1 SAR (RADAR) image with classified colours: deep NAVY = open sea water, " +
      "GOLD = vessels / metal targets, OLIVE = land. It is radar at ~10 m per pixel — you cannot resolve " +
      "fine detail, and two hulls lying alongside each other can merge into one wider gold blob. Cross-shaped " +
      "flares around bright targets are radar artefacts, not real structure."
    )
  }
  return (
    "This is a Sentinel-1 SAR (RADAR) false-colour image: bright YELLOW = vessels/metal, dark BLUE/PURPLE = " +
    "sea water. Radar at ~10 m per pixel; two touching hulls can merge, and cross flares are artefacts."
  )
}

/**
 * Run the vision model over a persisted Sentinel chip plus the AIS context of the
 * STS candidate, returning a structured read. The chip is CLEAN (no overlays) and
 * centred on the detected hull; the model is told what the imagery is and asked to
 * judge only what's visible. Advisory input — the deterministic SAR verdict stands.
 */
export async function analyzeStsImage(input: {
  row: SarRow
  event: AisEvent | undefined
  imo: string
  vesselName: string | null
}): Promise<SarVisionRead> {
  const { row, event, imo, vesselName } = input

  const place = event?.place ?? event?.maritime?.nearestPort ?? null
  const context = [
    `Vessel: ${vesselName ?? "unknown"} (IMO ${imo}).`,
    row.vesselLengthM || row.vesselBeamM
      ? `Registered size: ${row.vesselLengthM ? `${Math.round(row.vesselLengthM)} m LOA` : "?"} × ${row.vesselBeamM ? `${Math.round(row.vesselBeamM)} m beam` : "?"}.`
      : null,
    event?.durationHours ? `It loitered here for ~${Math.round(event.durationHours)} h${place ? ` (${place})` : ""} — a suspected ship-to-ship (STS) transfer.` : null,
    row.verdict ? `A deterministic radar detector graded this "${row.verdict}".` : null,
    row.primarySummary
      ? `The radar detected a hull at the centre measuring roughly ${(row.primarySummary as { lengthM: number }).lengthM}×${(row.primarySummary as { widthM: number }).widthM} m.`
      : null,
  ]
    .filter(Boolean)
    .join(" ")

  const prompt =
    `${imageBriefing(row)}\n\n` +
    `Context: ${context}\n\n` +
    "The image is centred on the suspected transfer location. Assess ONLY what you can actually see in the " +
    "image — do not infer from the context. Is there a ship-to-ship transfer here: two hulls moored side by " +
    "side, possibly with a connecting hose? How many hulls are at the centre? What is the setting (open water, " +
    "anchorage, a port/marina, near land, or cloud)? Any oil slick? Be conservative: if the resolution, radar " +
    "smear, or cloud makes it uncertain, answer 'unclear'. A single hull, or a busy anchorage with scattered " +
    "vessels, is NOT an STS transfer."

  const { object } = await generateObject({
    model: visionModel(),
    schema: sarVisionSchema,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image", image: `data:image/png;base64,${row.image}` },
        ],
      },
    ],
  })
  return object
}
