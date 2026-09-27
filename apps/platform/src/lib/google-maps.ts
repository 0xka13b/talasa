/**
 * Lazily loads the Google Maps JavaScript API on demand and resolves once
 * `window.google.maps` is ready. The script is injected at most once per page:
 * concurrent callers share a single in-flight promise, and later callers get the
 * already-loaded API immediately.
 *
 * The Maps API is typed loosely (`GoogleMaps` alias below) to avoid pulling in
 * `@types/google.maps` — the map panel touches only a small, stable slice of the
 * API (Map, Marker, InfoWindow, LatLngBounds).
 */
import { GOOGLE_MAPS_KEY } from "./ais-map"

export type GoogleMaps = any

declare global {
  interface Window {
    google?: { maps?: GoogleMaps }
  }
}

let loader: Promise<GoogleMaps> | null = null

export function loadGoogleMaps(): Promise<GoogleMaps> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser"))
  }
  if (window.google?.maps) return Promise.resolve(window.google.maps)
  if (loader) return loader
  if (!GOOGLE_MAPS_KEY) {
    return Promise.reject(new Error("VITE_GOOGLE_MAPS_API_KEY is not configured"))
  }

  loader = new Promise((resolve, reject) => {
    const script = document.createElement("script")
    const params = new URLSearchParams({ key: GOOGLE_MAPS_KEY, v: "weekly" })
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`
    script.async = true
    script.onload = () => {
      if (window.google?.maps) resolve(window.google.maps)
      else reject(new Error("Google Maps failed to initialise"))
    }
    script.onerror = () => {
      loader = null // allow a retry on the next mount
      reject(new Error("Google Maps script failed to load"))
    }
    document.head.appendChild(script)
  })
  return loader
}
