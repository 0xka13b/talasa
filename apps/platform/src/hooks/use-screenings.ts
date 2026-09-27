import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { screeningSchema } from "@talasa/shared"
import type { CreateScreeningInput, GraphBoard, Screening } from "@talasa/shared"
import { apiFetch } from "@/lib/api"

const KEY = ["screenings"] as const
const IN_FLIGHT: Screening["status"][] = ["queued", "running"]

/** Most-recent-first slice of screenings, for the sidebar's nested list. */
export function recentScreenings(screenings: Screening[], limit = 5): Screening[] {
  return [...screenings]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
}

export function useScreenings() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () =>
      screeningSchema.array().parse(await apiFetch<unknown>("/api/screenings")),
    refetchInterval: (query) =>
      (query.state.data ?? []).some((s) => IN_FLIGHT.includes(s.status))
        ? 1500
        : false,
  })
}

export function useScreening(id: string) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: async () =>
      screeningSchema.parse(await apiFetch<unknown>(`/api/screenings/${id}`)),
    refetchInterval: (query) =>
      query.state.data && IN_FLIGHT.includes(query.state.data.status)
        ? 1500
        : false,
  })
}

export function useCreateScreening() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateScreeningInput) =>
      apiFetch<Screening>("/api/screenings", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (screening) => {
      // Show the new screening in the sidebar immediately, then reconcile with
      // the server. Guard against a double-insert if a refetch already landed it.
      qc.setQueryData<Screening[]>(KEY, (prev) =>
        prev?.some((s) => s.id === screening.id) ? prev : [screening, ...(prev ?? [])]
      )
      qc.invalidateQueries({ queryKey: KEY })
    },
  })
}

export function useRunScreening() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<Screening>(`/api/screenings/${id}/run`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useSaveGraphBoard(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (board: GraphBoard) =>
      apiFetch<Screening>(`/api/screenings/${id}/graph-board`, {
        method: "PATCH",
        body: JSON.stringify(board),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useArchiveScreening() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<Screening>(`/api/screenings/${id}/archive`, { method: "POST" }),
    onSuccess: (_row, id) => {
      // Drop it from the active list immediately, then reconcile with the server.
      qc.setQueryData<Screening[]>(KEY, (prev) => prev?.filter((s) => s.id !== id))
      qc.invalidateQueries({ queryKey: KEY })
    },
  })
}

/** Colour palettes / imagery layers for the chip. */
export type SarPalette = "terrain" | "twopol" | "optical"

/** A geo-located point annotated on the SAR chip. */
export interface SarMarker {
  lat: number
  lon: number
  lengthM: number
  widthM: number
}

/** On-demand Sentinel-1 SAR verification of one STS-candidate AIS event. */
export interface StsSarResult {
  available: boolean
  verdict: "sts_contact" | "beam_anomaly" | "vessel_confirmed" | "no_detection" | null
  detail: string | null
  scene: { id: string; datetime: string | null } | null
  coverage: number | null
  primary: { distanceM: number; lengthM: number; widthM: number } | null
  contactCount: number
  targetCount: number | null
  vessel: { lengthM: number | null; beamM: number | null }
  /** Base64 PNG chip, or null when no covered scene was found. */
  image: string | null
  /** Which mission the displayed chip came from. */
  sensor: "sentinel-1" | "sentinel-2" | null
  /** Optical cloud cover % for a Sentinel-2 chip (null for SAR). */
  cloudCover: number | null
  /** Geographic box `[west, south, east, north]` of the chip, for pixel mapping. */
  imageBbox: [number, number, number, number] | null
  imageSize: { width: number; height: number } | null
  /** AIS loiter fix to annotate (the vessel's reported position). */
  aisFix: { lat: number; lon: number } | null
  /** SAR detection matched to the vessel. */
  primaryTarget: SarMarker | null
  /** Additional nearby SAR contacts (candidate counterparties). */
  contacts: SarMarker[]
  /** Full PU billed (detection + display), or 0 when served from cache. */
  processingUnits: number | null
  /** True when this result was served from the cache (no PU spent). */
  cached: boolean
}

/**
 * Lazily fetch SAR verification for the Nth AIS event, in a given palette.
 * Disabled until `enabled` (the user expands the panel), then cached forever for
 * the session so toggling show/hide (or re-selecting a palette) never re-spends
 * processing units.
 */
export function useStsSar(id: string, eventIdx: number, palette: SarPalette, enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, id, "sts-sar", eventIdx, palette],
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    queryFn: () =>
      apiFetch<StsSarResult>(`/api/screenings/${id}/sts/${eventIdx}/sar?palette=${palette}`, {
        method: "POST",
      }),
  })
}

export function useDeleteScreening() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/screenings/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
