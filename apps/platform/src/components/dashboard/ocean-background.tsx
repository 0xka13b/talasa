import { useEffect, useRef } from "react"
import * as THREE from "three"

const WIDTH_SEGMENTS = 100
const DEPTH_SEGMENTS = 60
const PLANE_WIDTH = 50
const PLANE_DEPTH = 80

// Monochrome base tone — neutral grey. Brightness alone carries crest/trough,
// never hue, so the surface reads as one material.
const BASE_COLOR = new THREE.Color("#9ca3af")

/**
 * Overlapping directional sine waves — the classic "sum of sines" ocean
 * approximation. Each travels its own direction, wavelength and speed so
 * crests never line up, reading as chop rather than one uniform ripple.
 */
const WAVE_COMPONENTS = (
  [
    { amp: 0.55, wavelength: 20, speed: 0.7, dir: [1, 0.2] },
    { amp: 0.35, wavelength: 12, speed: 1.05, dir: [0.5, 1] },
    { amp: 0.22, wavelength: 7.5, speed: 1.4, dir: [-0.7, 0.4] },
    { amp: 0.12, wavelength: 4, speed: 1.9, dir: [0.3, -1] },
  ] as const
).map((w) => {
  const len = Math.hypot(w.dir[0], w.dir[1]) || 1
  return {
    amp: w.amp,
    speed: w.speed,
    k: (2 * Math.PI) / w.wavelength,
    dx: w.dir[0] / len,
    dz: w.dir[1] / len,
  }
})
const MAX_AMPLITUDE = WAVE_COMPONENTS.reduce((sum, w) => sum + w.amp, 0)

function waveHeight(x: number, z: number, t: number) {
  let y = 0
  for (const w of WAVE_COMPONENTS) {
    y += w.amp * Math.sin(w.k * (w.dx * x + w.dz * z) - w.speed * t)
  }
  return y
}

/**
 * Ambient animated ocean-surface backdrop — a monochrome point grid whose
 * heightfield moves like real swell (sum-of-sines, no rotation: the camera is
 * fixed, only the water moves). Replaces the mesh-gradient hero background.
 */
export function OceanBackground() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const container: HTMLDivElement = containerRef.current

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      return // no WebGL — leave the backdrop empty rather than crash the page
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200)
    camera.position.set(0, 8, 22)
    camera.lookAt(0, -4, -30)

    const numPoints = (WIDTH_SEGMENTS + 1) * (DEPTH_SEGMENTS + 1)
    const positions = new Float32Array(numPoints * 3)
    const colors = new Float32Array(numPoints * 3)

    let p = 0
    for (let i = 0; i <= WIDTH_SEGMENTS; i++) {
      const x = (i / WIDTH_SEGMENTS - 0.5) * PLANE_WIDTH
      for (let j = 0; j <= DEPTH_SEGMENTS; j++) {
        const z = -(j / DEPTH_SEGMENTS) * PLANE_DEPTH
        positions[3 * p] = x
        positions[3 * p + 1] = 0
        positions[3 * p + 2] = z
        p++
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3))

    const material = new THREE.PointsMaterial({
      size: 0.16,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    })
    const points = new THREE.Points(geometry, material)
    scene.add(points)

    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    function resize() {
      const { clientWidth: w, clientHeight: h } = container
      if (w === 0 || h === 0) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)

    const positionAttr = geometry.attributes.position as THREE.BufferAttribute
    const colorAttr = geometry.attributes.color as THREE.BufferAttribute

    function updateSurface(t: number) {
      for (let idx = 0; idx < numPoints; idx++) {
        const x = positionAttr.getX(idx)
        const z = positionAttr.getZ(idx)
        const y = waveHeight(x, z, t)
        positionAttr.setY(idx, y)
        const intensity = 0.4 + 0.25 * (y / MAX_AMPLITUDE + 1)
        colorAttr.setXYZ(
          idx,
          BASE_COLOR.r * intensity,
          BASE_COLOR.g * intensity,
          BASE_COLOR.b * intensity
        )
      }
      positionAttr.needsUpdate = true
      colorAttr.needsUpdate = true
    }

    const clock = new THREE.Clock()
    let frame = 0

    function render() {
      const t = reduceMotion ? 0 : clock.getElapsedTime()
      updateSurface(t)
      renderer.render(scene, camera)
      if (!reduceMotion) frame = requestAnimationFrame(render)
    }
    render()

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 animate-in overflow-hidden duration-1000 fade-in"
    />
  )
}
