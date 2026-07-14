import * as THREE from 'three'
import type { Component, Wheel, Axle } from '../../types/vehicle'

/**
 * Wheel detection over segmented components. Deterministic scoring:
 * a wheel is a roughly cylindrical component whose rotation axis is lateral (Z),
 * whose diameter is in a plausible band, and which sits at the track surface.
 */

const DIAMETER_MIN = 18
const DIAMETER_MAX = 45
const WIDTH_MIN = 4
const WIDTH_MAX = 40
const GROUND_GAP_MAX = 2.0 // mm — wheels define the track plane

interface WheelCandidate {
  component: Component
  diameter: number
  contactWidth: number
  roundness: number
  score: number
}

/** Radial uniformity of vertices about the component centre in the XY plane. */
function measureRoundness(geometry: THREE.BufferGeometry, center: THREE.Vector3): number {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  const radii: number[] = []
  const step = Math.max(1, Math.floor(pos.count / 400))
  for (let i = 0; i < pos.count; i += step) {
    const dx = pos.getX(i) - center.x
    const dy = pos.getY(i) - center.y
    radii.push(Math.hypot(dx, dy))
  }
  if (radii.length < 8) return 1
  // Outer rim only — hubs/spokes sit at small radii
  radii.sort((a, b) => b - a)
  const rim = radii.slice(0, Math.max(8, Math.floor(radii.length * 0.3)))
  const mean = rim.reduce((s, r) => s + r, 0) / rim.length
  if (mean === 0) return 1
  const variance = rim.reduce((s, r) => s + (r - mean) ** 2, 0) / rim.length
  return Math.sqrt(variance) / mean
}

function scoreCandidate(c: Component): WheelCandidate | null {
  const size = c.bbox.getSize(new THREE.Vector3())
  const diameter = Math.max(size.x, size.y)
  const contactWidth = size.z
  // Cylinder with lateral axis: X and Y extents nearly equal, Z extent smaller
  const circularity = 1 - Math.abs(size.x - size.y) / Math.max(size.x, size.y, 1e-6)
  if (circularity < 0.85) return null
  if (diameter < DIAMETER_MIN || diameter > DIAMETER_MAX) return null
  if (contactWidth < WIDTH_MIN || contactWidth > WIDTH_MAX) return null
  if (contactWidth > diameter * 1.1) return null
  if (c.bbox.min.y > GROUND_GAP_MAX) return null

  const roundness = measureRoundness(c.geometry, c.center)
  if (roundness > 0.12) return null

  const score = circularity * (1 - roundness) * (1 - c.bbox.min.y / (GROUND_GAP_MAX + 1))
  return { component: c, diameter, contactWidth, roundness, score }
}

export interface WheelDetection {
  wheels: Wheel[]
  frontAxle: Axle | null
  rearAxle: Axle | null
  wheelbase: number | null
  confidence: number
}

export function detectWheels(components: Component[]): WheelDetection {
  const candidates = components
    .map(scoreCandidate)
    .filter((c): c is WheelCandidate => c !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)

  if (candidates.length < 4) {
    return { wheels: [], frontAxle: null, rearAxle: null, wheelbase: null, confidence: 0 }
  }

  // Pick the 4 that best form two axles: cluster by X into two groups of two
  const byX = [...candidates].sort((a, b) => a.component.center.x - b.component.center.x)
  // Greedy pairing: opposing wheels share X (within tolerance) and mirror in Z
  const used = new Set<number>()
  const pairs: [WheelCandidate, WheelCandidate][] = []
  for (let i = 0; i < byX.length; i++) {
    if (used.has(i)) continue
    for (let j = i + 1; j < byX.length; j++) {
      if (used.has(j)) continue
      const a = byX[i]
      const b = byX[j]
      const dx = Math.abs(a.component.center.x - b.component.center.x)
      const mirrored = Math.sign(a.component.center.z) !== Math.sign(b.component.center.z)
      if (dx < 8 && mirrored) {
        pairs.push([a, b])
        used.add(i)
        used.add(j)
        break
      }
    }
  }

  if (pairs.length < 2) {
    return { wheels: [], frontAxle: null, rearAxle: null, wheelbase: null, confidence: 0 }
  }

  // Two axles: the pair with larger mean X is the front (nose points +X)
  pairs.sort(
    (p, q) =>
      (q[0].component.center.x + q[1].component.center.x) / 2 -
      (p[0].component.center.x + p[1].component.center.x) / 2,
  )
  const [frontPair, rearPair] = [pairs[0], pairs[1]]

  const makeWheel = (cand: WheelCandidate, isFront: boolean): Wheel => {
    const c = cand.component
    const left = c.center.z > 0
    return {
      componentId: c.id,
      center: c.center.clone(),
      diameter: cand.diameter,
      contactWidth: cand.contactWidth,
      roundness: cand.roundness,
      position: `${isFront ? 'front' : 'rear'}-${left ? 'left' : 'right'}` as Wheel['position'],
      groundGap: c.bbox.min.y,
      innerZ: left ? c.bbox.min.z : c.bbox.max.z,
      outerZ: left ? c.bbox.max.z : c.bbox.min.z,
    }
  }

  const frontWheels = frontPair.map((c) => makeWheel(c, true))
  const rearWheels = rearPair.map((c) => makeWheel(c, false))

  const makeAxle = (wheels: Wheel[]): Axle => {
    const x = wheels.reduce((s, w) => s + w.center.x, 0) / wheels.length
    let innerDistance: number | null = null
    if (wheels.length === 2) {
      const [a, b] = wheels
      innerDistance = Math.abs(a.innerZ - b.innerZ)
    }
    return { x, wheels, innerDistance }
  }

  const frontAxle = makeAxle(frontWheels)
  const rearAxle = makeAxle(rearWheels)
  const wheelbase = Math.abs(frontAxle.x - rearAxle.x)

  const meanScore =
    [...frontPair, ...rearPair].reduce((s, c) => s + c.score, 0) / 4
  const confidence = Math.min(1, meanScore * (wheelbase > 60 ? 1 : 0.5))

  return {
    wheels: [...frontWheels, ...rearWheels],
    frontAxle,
    rearAxle,
    wheelbase,
    confidence,
  }
}
