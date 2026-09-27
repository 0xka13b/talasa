import { useEffect, useRef, useState } from "react"
import { IconLoader2, IconSatellite } from "@tabler/icons-react"
import type { AisBrief, AisEvent, VesselBrief } from "@talasa/shared"
import { Badge } from "@/components/ui/badge"
import { useStsSar } from "@/hooks/use-screenings"
import type { SarPalette, StsSarResult } from "@/hooks/use-screenings"
import { cn } from "@/lib/utils"
import { loadGoogleMaps } from "@/lib/google-maps"
import {
  GOOGLE_MAPS_KEY,
  KIND_COLOR,
  KIND_LABEL,
  eventDetail,
  locationLabel,
  locationOneLine,
  mappableEvents,
  shortUtc,
} from "@/lib/ais-map"
import type { AisPoint } from "@/lib/ais-map"
import { formatDate } from "../vessel-labels"
import { Empty, EmptyPanel, SectionHeading } from "./field"

// Baseline "vessel is transmitting" colour for the timeline — a calm slate blue
// that reads as normal against the warm/red event colours (KIND_COLOR).
const TRANSMIT_COLOR = "#3f5a8a"

export function AisPanel({ b }: { b: VesselBrief }) {
  const ais = b.ais
  const [showMap, setShowMap] = useState(false)
  if (!ais || !ais.available) {
    return (
      <EmptyPanel>
        No AIS behavioural history was available for the analysed window.
      </EmptyPanel>
    )
  }
  const points = mappableEvents(ais.events)
  const hasTimeline = ais.events.some((e) => e.startUtc)
  return (
    <div className="flex flex-col gap-8">
      <StatsRow ais={ais} />
      {ais.highRiskZoneActivity && (
        <div className="rounded-lg border-l-4 border-red-500/60 bg-red-500/5 px-4 py-2.5 text-sm">
          Activity detected in a known high-risk STS zone.
        </div>
      )}

      {hasTimeline && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <SectionHeading className="text-2xl">AIS transmission</SectionHeading>
            <Legend />
          </div>
          <TransmissionTimeline events={ais.events} />
        </section>
      )}

      {points.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionHeading className="text-2xl">Event map</SectionHeading>
            <Toggle checked={showMap} onChange={setShowMap} label="Show map" />
          </div>
          {showMap &&
            (GOOGLE_MAPS_KEY ? (
              <AisMap points={points} />
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Map unavailable — set{" "}
                <code className="text-xs">VITE_GOOGLE_MAPS_API_KEY</code> to
                render the interactive map. The events are listed below.
              </div>
            ))}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <SectionHeading className="text-2xl">Behavioural events</SectionHeading>
        <EventList events={ais.events} screeningId={b.screeningId} />
        {ais.truncated && (
          <p className="text-xs text-muted-foreground">
            Showing the most significant events; some were omitted.
          </p>
        )}
      </section>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {ais.summary} STS events are suspected (single-vessel track) and never
        confirmed.
      </p>
    </div>
  )
}

function StatsRow({ ais }: { ais: AisBrief }) {
  const stats: { label: string; value: number | string }[] = [
    { label: "Positions", value: ais.positionCount },
    { label: "Span", value: `${ais.spanDays}d` },
    { label: "Dark gaps", value: ais.darkGapCount },
    { label: "STS candidates", value: ais.stsCandidateCount },
    { label: "Speed anomalies", value: ais.speedAnomalyCount },
  ]
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-5">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col gap-0.5">
          <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {s.label}
          </dt>
          <dd className="text-xl font-semibold tabular-nums">{s.value}</dd>
        </div>
      ))}
    </dl>
  )
}

// One legend, shared by the timeline, map and list — colours never diverge.
const LEGEND: { label: string; color: string }[] = [
  { label: "Transmitting", color: TRANSMIT_COLOR },
  { label: KIND_LABEL.dark_gap, color: KIND_COLOR.dark_gap },
  { label: KIND_LABEL.sts_candidate, color: KIND_COLOR.sts_candidate },
  { label: KIND_LABEL.speed_anomaly, color: KIND_COLOR.speed_anomaly },
]

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {LEGEND.map((item) => (
        <span
          key={item.label}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  )
}

/** A tiny accessible on/off switch — no shared Switch primitive exists yet. */
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none">
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
          checked ? "bg-primary" : "bg-input"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform",
            checked && "translate-x-4"
          )}
        />
      </button>
    </label>
  )
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const parseMs = (iso: string | null | undefined): number =>
  iso ? Date.parse(iso) : NaN
const clampPct = (n: number): number => Math.min(94, Math.max(6, n))

interface HoverInfo {
  left: number
  color: string
  label: string
  lines: string[]
}

/**
 * A compact transmission timeline: the observed window is bucketed into uniform
 * bars — blue where the vessel was transmitting, event-coloured where a dark gap
 * overlaps — with STS / speed-anomaly events pinned as triangle markers above.
 * Colours are the shared KIND_COLOR set, so the strip, map and list all agree.
 * Hovering any bar or marker reveals the underlying event.
 */
function TransmissionTimeline({ events }: { events: AisEvent[] }) {
  const [hover, setHover] = useState<HoverInfo | null>(null)

  const timed = events.filter((e) => !Number.isNaN(parseMs(e.startUtc)))
  if (timed.length === 0) return null

  const starts = timed.map((e) => parseMs(e.startUtc))
  const ends = timed.map((e) => {
    const end = parseMs(e.endUtc)
    return Number.isNaN(end) ? parseMs(e.startUtc) : end
  })
  const t0 = Math.min(...starts)
  const t1 = Math.max(...ends, t0 + WEEK_MS)
  const span = t1 - t0

  const count = Math.min(52, Math.max(16, Math.round(span / WEEK_MS)))
  const bucketMs = span / count
  const gaps = timed.filter((e) => e.kind === "dark_gap")
  const bars = Array.from({ length: count }, (_, i) => {
    const bStart = t0 + i * bucketMs
    const bEnd = bStart + bucketMs
    const gap = gaps.find((g) => {
      const gs = parseMs(g.startUtc)
      const ge = parseMs(g.endUtc) || gs
      return gs < bEnd && ge > bStart
    })
    return { bStart, bEnd, gap }
  })
  const marks = timed
    .filter((e) => e.kind !== "dark_gap")
    .map((e) => ({ left: ((parseMs(e.startUtc) - t0) / span) * 100, e }))

  const eventHover = (left: number, e: AisEvent): HoverInfo => ({
    left,
    color: KIND_COLOR[e.kind],
    label: KIND_LABEL[e.kind],
    lines: [
      locationOneLine(e),
      `${shortUtc(e.startUtc)} → ${shortUtc(e.endUtc)}`,
      eventDetail(e),
    ].filter((l): l is string => Boolean(l)),
  })

  return (
    <div className="flex flex-col gap-2">
      <div className="relative" onMouseLeave={() => setHover(null)}>
        {hover && (
          <div
            className="pointer-events-none absolute bottom-full z-10 mb-2 w-max max-w-[220px] -translate-x-1/2 rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md"
            style={{ left: `${clampPct(hover.left)}%` }}
          >
            <div className="flex items-center gap-1.5 font-medium">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: hover.color }}
              />
              {hover.label}
            </div>
            {hover.lines.map((l, i) => (
              <div key={i} className="text-muted-foreground">
                {l}
              </div>
            ))}
          </div>
        )}

        {/* STS / speed-anomaly markers */}
        <div className="relative mb-1 h-2.5">
          {marks.map((m, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${KIND_LABEL[m.e.kind]} event`}
              onMouseEnter={() => setHover(eventHover(m.left, m.e))}
              className="absolute bottom-0 h-0 w-0 -translate-x-1/2 cursor-default border-x-4 border-b-[7px] border-x-transparent"
              style={{
                left: `${m.left}%`,
                borderBottomColor: KIND_COLOR[m.e.kind],
              }}
            />
          ))}
        </div>

        {/* Transmission bars */}
        <div className="flex h-9 items-stretch gap-px">
          {bars.map((bar, i) => (
            <div
              key={i}
              onMouseEnter={() =>
                setHover(
                  bar.gap
                    ? eventHover(
                        (((bar.bStart + bar.bEnd) / 2 - t0) / span) * 100,
                        bar.gap
                      )
                    : {
                        left: (((bar.bStart + bar.bEnd) / 2 - t0) / span) * 100,
                        color: TRANSMIT_COLOR,
                        label: "Transmitting",
                        lines: [
                          `${formatDate(new Date(bar.bStart).toISOString())} – ${formatDate(new Date(bar.bEnd).toISOString())}`,
                        ],
                      }
                )
              }
              className="flex-1 cursor-default rounded-[2px] transition-opacity hover:opacity-75"
              style={{
                backgroundColor: bar.gap ? KIND_COLOR.dark_gap : TRANSMIT_COLOR,
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>{formatDate(new Date(t0).toISOString())}</span>
        <span>{formatDate(new Date(t1).toISOString())}</span>
      </div>
    </div>
  )
}

/**
 * Interactive Google map of the AIS events. Client-only (touches the DOM +
 * loads the Maps script), so it must never render during SSR — the parent gates
 * it behind a key check and this component itself no-ops until mounted.
 */
function AisMap({ points }: { points: AisPoint[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const markers: any[] = []
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !ref.current) return
        const map = new maps.Map(ref.current, {
          mapTypeId: "roadmap",
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          gestureHandling: "cooperative",
        })
        const bounds = new maps.LatLngBounds()
        const info = new maps.InfoWindow()
        for (const p of points) {
          const position = { lat: p.lat, lng: p.lon }
          bounds.extend(position)
          const highRisk = Boolean(p.highRiskArea)
          const marker = new maps.Marker({
            position,
            map,
            title: KIND_LABEL[p.kind],
            icon: {
              path: maps.SymbolPath.CIRCLE,
              fillColor: KIND_COLOR[p.kind],
              fillOpacity: 0.9,
              scale: 7,
              strokeColor: highRisk ? "#dc2626" : "#ffffff",
              strokeWeight: highRisk ? 3 : 1.5,
            },
          })
          marker.addListener("click", () => {
            info.setContent(infoHtml(p))
            info.open({ map, anchor: marker })
          })
          markers.push(marker)
        }
        map.fitBounds(bounds, 48)
        // A single point (or several coincident ones) fits to max zoom — pull back.
        maps.event.addListenerOnce(map, "idle", () => {
          if (map.getZoom() > 9) map.setZoom(9)
        })
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Map failed to load")
      })
    return () => {
      cancelled = true
      for (const m of markers) m.setMap(null)
    }
  }, [points])

  if (error) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        Couldn't load the map ({error}). The events are listed below.
      </div>
    )
  }
  return (
    <div
      ref={ref}
      className="h-[420px] w-full overflow-hidden rounded-lg border"
    />
  )
}

function infoHtml(p: AisPoint): string {
  const rows: string[] = [
    `<strong>${KIND_LABEL[p.kind]}</strong>`,
    escapeHtml(locationOneLine(p)),
    `${shortUtc(p.startUtc)} → ${shortUtc(p.endUtc)} UTC`,
  ]
  const detail = eventDetail(p)
  if (detail) rows.push(detail)
  if (p.highRiskArea) rows.push(`⚠ ${escapeHtml(p.highRiskArea)}`)
  return `<div style="font:12px/1.5 system-ui,sans-serif;color:#111;max-width:220px">${rows.join("<br/>")}</div>`
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c
  )
}

function EventList({ events, screeningId }: { events: AisEvent[]; screeningId: string }) {
  if (events.length === 0) return <Empty>No behavioural events flagged.</Empty>
  return (
    <ul className="flex flex-col divide-y divide-border rounded-lg border">
      {events.map((e, i) => {
        const loc = locationLabel(e)
        const canVerify = e.kind === "sts_candidate" && e.lat != null && e.lon != null
        return (
          <li key={i} className="flex flex-col gap-1 p-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: KIND_COLOR[e.kind] }}
              />
              <span className="text-sm font-medium">{KIND_LABEL[e.kind]}</span>
              <span className="text-sm">{loc.primary}</span>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {shortUtc(e.startUtc)} → {shortUtc(e.endUtc)}
              </span>
              {e.highRiskArea && (
                <Badge className="bg-red-500/15 text-red-600 dark:text-red-400">
                  {e.highRiskArea}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-x-3 pl-6 text-xs text-muted-foreground">
              {loc.secondary && <span>{loc.secondary}</span>}
              {eventDetail(e) && <span>{eventDetail(e)}</span>}
            </div>
            {canVerify && <StsSarSection screeningId={screeningId} eventIdx={i} />}
          </li>
        )
      })}
    </ul>
  )
}

// ---- On-demand Sentinel-1 SAR verification of an STS candidate ----

const VERDICT_META: Record<
  NonNullable<StsSarResult["verdict"]>,
  { label: string; className: string }
> = {
  sts_contact: { label: "STS contact", className: "bg-red-500/15 text-red-600 dark:text-red-400" },
  beam_anomaly: { label: "Beam anomaly", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  vessel_confirmed: { label: "Vessel confirmed", className: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  no_detection: { label: "No detection", className: "bg-slate-500/15 text-slate-600 dark:text-slate-400" },
}

/** Collapsed by default: a toggle that fetches + renders the SAR chip on demand. */
function StsSarSection({ screeningId, eventIdx }: { screeningId: string; eventIdx: number }) {
  const [shown, setShown] = useState(false)
  return (
    <div className="pl-6 pt-1">
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 transition-colors hover:text-sky-500 dark:text-sky-400"
      >
        <IconSatellite className="size-3.5" />
        {shown ? "Hide satellite check" : "Verify with Sentinel-1 satellite"}
      </button>
      {shown && <StsSarPanel screeningId={screeningId} eventIdx={eventIdx} />}
    </div>
  )
}

const PALETTES: { id: SarPalette; label: string }[] = [
  { id: "terrain", label: "SAR terrain" },
  { id: "twopol", label: "SAR two-pol" },
  { id: "optical", label: "Optical (S2)" },
]

const CAPTION: Record<SarPalette, string> = {
  terrain: "Sentinel-1 SAR — gold = vessels, navy = water",
  twopol: "Sentinel-1 SAR (VV+VH) — yellow = vessels",
  optical: "Sentinel-2 optical (true colour)",
}

function StsSarPanel({ screeningId, eventIdx }: { screeningId: string; eventIdx: number }) {
  const [palette, setPalette] = useState<SarPalette>("terrain")
  // Mounted only when expanded ⇒ enabled=true; cached per palette so re-expanding
  // or switching back to a seen palette is free.
  const { data, isPending, isError, error } = useStsSar(screeningId, eventIdx, palette, true)

  if (isPending) {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <IconLoader2 className="size-3.5 animate-spin" />
        Fetching satellite imagery — searching for a contemporaneous pass…
      </div>
    )
  }
  if (isError) {
    return (
      <p className="mt-2 text-xs text-red-600 dark:text-red-400">
        {error instanceof Error ? error.message : "Satellite verification failed."}
      </p>
    )
  }
  if (!data.available) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        No Sentinel-1 pass intersected this loiter window — nothing to verify against.
      </p>
    )
  }

  const meta = data.verdict ? VERDICT_META[data.verdict] : null
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {meta ? (
          <Badge className={meta.className}>{meta.label}</Badge>
        ) : (
          <Badge className="bg-slate-500/15 text-slate-600 dark:text-slate-400">SAR: no covered pass</Badge>
        )}
        {data.sensor === "sentinel-2" && data.cloudCover != null && (
          <span className="text-xs text-muted-foreground">{Math.round(data.cloudCover)}% cloud</span>
        )}
        {data.sensor === "sentinel-1" && data.coverage != null && (
          <span className="text-xs text-muted-foreground">{Math.round(data.coverage * 100)}% AOI imaged</span>
        )}
        <div className="ml-auto flex overflow-hidden rounded-md border">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPalette(p.id)}
              className={cn(
                "px-2 py-0.5 text-[11px] transition-colors",
                palette === p.id
                  ? "bg-sky-500/20 text-sky-600 dark:text-sky-400"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {data.detail && <p className="text-xs text-muted-foreground">{data.detail}</p>}
      {data.image ? (
        <StsSarCanvas data={data} />
      ) : (
        <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          {palette === "optical"
            ? "No usable Sentinel-2 optical scene in this window (cloud cover or no pass). Optical is daylight- and cloud-dependent — the SAR verdict above still stands."
            : "A Sentinel-1 scene exists in-window, but its swath edge didn't cover this point (no-data over the AOI)."}
        </p>
      )}
      <p className="text-center text-[11px] text-muted-foreground">
        {CAPTION[palette]}
        {data.targetCount != null && ` · ${data.targetCount} SAR target(s) detected`}
        {data.vessel.beamM != null && ` · registered beam ${Math.round(data.vessel.beamM)} m`}
      </p>
    </div>
  )
}

/**
 * Renders the SAR chip on a canvas and overlays annotations: the AIS loiter fix
 * (cyan crosshair), the matched SAR hull (gold box + size), any nearby contacts
 * (orange rings), and a scale bar. Draws in the image's native pixel space; CSS
 * scales the whole canvas down, so overlays stay pinned to the imagery.
 */
function StsSarCanvas({ data }: { data: StsSarResult }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !data.image || !data.imageBbox || !data.imageSize) return
    const { width: W, height: H } = data.imageSize
    const [w, s, e, n] = data.imageBbox
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const lonToX = (lon: number) => ((lon - w) / (e - w)) * W
    const latToY = (lat: number) => ((n - lat) / (n - s)) * H
    const midLat = (n + s) / 2
    const groundW = (e - w) * 111_320 * Math.cos((midLat * Math.PI) / 180)
    const pxPerM = W / groundW

    ctx.font = "600 19px ui-sans-serif, system-ui, sans-serif"
    // A text label inside a rounded translucent pill, anchored top-left.
    const pill = (text: string, x: number, y: number, color: string) => {
      const pad = 7
      const tw = ctx.measureText(text).width
      ctx.fillStyle = "rgba(6,12,22,0.78)"
      ctx.beginPath()
      ctx.roundRect(x, y, tw + pad * 2, 26, 6)
      ctx.fill()
      ctx.fillStyle = color
      ctx.fillText(text, x + pad, y + 18)
    }

    // Largest "nice" round distance under a quarter of the frame, for the scale bar.
    const niceScaleM = (): number => {
      const target = groundW / 4
      const steps = [100, 200, 250, 500, 1000, 2000, 5000]
      return steps.filter((v) => v <= target).pop() ?? 100
    }

    const img = new Image()
    img.onload = () => {
      ctx.clearRect(0, 0, W, H)
      ctx.drawImage(img, 0, 0, W, H)

      const ais = data.aisFix ? { x: lonToX(data.aisFix.lon), y: latToY(data.aisFix.lat) } : null
      const hull = data.primaryTarget
        ? { x: lonToX(data.primaryTarget.lon), y: latToY(data.primaryTarget.lat) }
        : null

      // Nearby contacts (candidate counterparties) — orange rings.
      for (const c of data.contacts) {
        ctx.strokeStyle = "#fb923c"
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(lonToX(c.lon), latToY(c.lat), Math.max(15, (c.lengthM / 2) * pxPerM), 0, Math.PI * 2)
        ctx.stroke()
      }

      // Dashed connector between the AIS position and the SAR hull, labelled with
      // the offset — this is the match, so make it the visual focus.
      if (ais && hull) {
        ctx.strokeStyle = "rgba(125,211,252,0.9)"
        ctx.lineWidth = 2
        ctx.setLineDash([7, 6])
        ctx.beginPath()
        ctx.moveTo(ais.x, ais.y)
        ctx.lineTo(hull.x, hull.y)
        ctx.stroke()
        ctx.setLineDash([])
        if (data.primary) {
          const mx = (ais.x + hull.x) / 2, my = (ais.y + hull.y) / 2
          pill(`${data.primary.distanceM} m`, mx + 8, my - 12, "#e0f2fe")
        }
      }

      // Matched SAR hull — gold box sized to the detection (no inline label).
      if (hull && data.primaryTarget) {
        const bw = Math.max(20, data.primaryTarget.lengthM * pxPerM)
        const bh = Math.max(14, data.primaryTarget.widthM * pxPerM)
        ctx.strokeStyle = "#fbbf24"
        ctx.lineWidth = 3.5
        ctx.strokeRect(hull.x - bw / 2, hull.y - bh / 2, bw, bh)
      }

      // AIS loiter fix — cyan ring + centre dot (no inline label).
      if (ais) {
        ctx.strokeStyle = "#38bdf8"
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(ais.x, ais.y, 13, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = "#38bdf8"
        ctx.beginPath()
        ctx.arc(ais.x, ais.y, 3.5, 0, Math.PI * 2)
        ctx.fill()
      }

      // Legend (top-left) — keeps labels off the markers.
      const rows: { swatch: (cx: number, cy: number) => void; text: string }[] = []
      if (hull) {
        const dims = data.primaryTarget
          ? ` ${Math.round(data.primaryTarget.lengthM)}×${Math.round(data.primaryTarget.widthM)} m`
          : ""
        rows.push({
          text: `SAR hull${dims}`,
          swatch: (cx, cy) => {
            ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 3
            ctx.strokeRect(cx - 8, cy - 6, 16, 12)
          },
        })
      }
      if (ais) {
        rows.push({
          text: "AIS position",
          swatch: (cx, cy) => {
            ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 3
            ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.stroke()
            ctx.fillStyle = "#38bdf8"; ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fill()
          },
        })
      }
      if (data.contacts.length > 0) {
        rows.push({
          text: `contact ×${data.contacts.length}`,
          swatch: (cx, cy) => {
            ctx.strokeStyle = "#fb923c"; ctx.lineWidth = 3
            ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.stroke()
          },
        })
      }
      if (rows.length > 0) {
        const rowH = 28, padX = 14, swW = 26
        const boxW = padX * 2 + swW + Math.max(...rows.map((r) => ctx.measureText(r.text).width)) + 6
        const boxH = 10 + rows.length * rowH
        ctx.fillStyle = "rgba(6,12,22,0.7)"
        ctx.beginPath(); ctx.roundRect(16, 16, boxW, boxH, 8); ctx.fill()
        rows.forEach((r, i) => {
          const cy = 16 + 10 + rowH / 2 + i * rowH
          r.swatch(16 + padX + swW / 2, cy)
          ctx.fillStyle = "#e2e8f0"
          ctx.fillText(r.text, 16 + padX + swW + 6, cy + 6)
        })
      }

      // Scale bar (bottom-left).
      const barM = niceScaleM()
      const barPx = barM * pxPerM
      const bx = 20, by = H - 30
      ctx.strokeStyle = "rgba(255,255,255,0.95)"
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(bx, by); ctx.lineTo(bx + barPx, by)
      ctx.moveTo(bx, by - 6); ctx.lineTo(bx, by + 6)
      ctx.moveTo(bx + barPx, by - 6); ctx.lineTo(bx + barPx, by + 6)
      ctx.stroke()
      const barLabel = barM >= 1000 ? `${barM / 1000} km` : `${barM} m`
      pill(barLabel, bx, by - 34, "#e2e8f0")
    }
    img.src = `data:image/png;base64,${data.image}`
  }, [data])

  return (
    <canvas
      ref={canvasRef}
      className="mx-auto w-full max-w-md rounded-md border bg-slate-950"
      aria-label="Annotated Sentinel satellite chip of the STS candidate location"
    />
  )
}
