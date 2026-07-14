import type { VehicleAnalysis, Component } from '../types/vehicle'
import type { RuleResult, RuleVisual, RuleLimit, CameraTarget } from '../types/rules'

export const fmt = (v: number, digits = 1) => v.toFixed(digits)

/** Evaluate a measured value against a limit, with a warning band near the edge. */
export function judge(measured: number, limit: RuleLimit): { status: 'pass' | 'warning' | 'fail'; margin: number } {
  const band = limit.warnBand ?? 0.08
  const span =
    limit.min !== undefined && limit.max !== undefined
      ? limit.max - limit.min
      : Math.max(Math.abs(limit.min ?? limit.max ?? 1) * 0.2, 1)
  const warnDist = span * band

  if (limit.min !== undefined && measured < limit.min) return { status: 'fail', margin: limit.min - measured }
  if (limit.max !== undefined && measured > limit.max) return { status: 'fail', margin: measured - limit.max }

  let minDist = Infinity
  if (limit.min !== undefined) minDist = Math.min(minDist, measured - limit.min)
  if (limit.max !== undefined) minDist = Math.min(minDist, limit.max - measured)
  if (minDist < warnDist) return { status: 'warning', margin: minDist }
  return { status: 'pass', margin: minDist }
}

export function limitText(limit: RuleLimit): string {
  const u = limit.unit
  if (limit.min !== undefined && limit.max !== undefined) return `${fmt(limit.min)}–${fmt(limit.max)} ${u}`
  if (limit.min !== undefined) return `≥ ${fmt(limit.min)} ${u}`
  if (limit.max !== undefined) return `≤ ${fmt(limit.max)} ${u}`
  return ''
}

/** Proportional penalty: points per whole unit of non-compliance, rounded up. */
export function proportionalPenalty(margin: number, pointsPerUnit: number): number {
  return Math.ceil(Math.max(0, margin)) * pointsPerUnit
}

export function manual(ruleId: string, explanation: string, remedy?: string): RuleResult {
  return { ruleId, status: 'manual', explanation, remedy, confidence: 1, visuals: [] }
}

export function cameraFor(
  center: [number, number, number],
  distance: number,
  dir: [number, number, number] = [0.7, 0.5, 0.8],
): CameraTarget {
  const len = Math.hypot(...dir)
  return {
    position: [
      center[0] + (dir[0] / len) * distance,
      center[1] + (dir[1] / len) * distance,
      center[2] + (dir[2] / len) * distance,
    ],
    lookAt: center,
  }
}

/** Max/min vertex coordinate within a spatial predicate — deterministic vertex scan. */
export function scanExtremes(
  positions: Float32Array,
  predicate: (x: number, y: number, z: number) => boolean,
): { minY: number; maxY: number; minX: number; maxX: number; count: number } {
  let minY = Infinity
  let maxY = -Infinity
  let minX = Infinity
  let maxX = -Infinity
  let count = 0
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]
    const y = positions[i + 1]
    const z = positions[i + 2]
    if (!predicate(x, y, z)) continue
    count++
    if (y < minY) minY = y
    if (y > maxY) maxY = y
    if (x < minX) minX = x
    if (x > maxX) maxX = x
  }
  return { minY, maxY, minX, maxX, count }
}

/** Non-wheel components fully forward of reference plane A (nose + front wing assembly). */
export function frontAssemblyComponents(a: VehicleAnalysis): Component[] {
  if (a.planes.a === null) return []
  const planeA = a.planes.a
  return a.components.filter((c) => !a.wheelComponentIds.has(c.id) && c.bbox.min.x >= planeA - 0.5)
}

/** Non-wheel components fully rearward of reference plane B (rear wing assembly). */
export function rearAssemblyComponents(a: VehicleAnalysis): Component[] {
  if (a.planes.b === null) return []
  const planeB = a.planes.b
  return a.components.filter((c) => !a.wheelComponentIds.has(c.id) && c.bbox.max.x <= planeB + 0.5)
}

/** Wing-like: spans laterally more than it is thick or deep. */
export function wingLike(c: Component): boolean {
  const size = { x: c.bbox.max.x - c.bbox.min.x, y: c.bbox.max.y - c.bbox.min.y, z: c.bbox.max.z - c.bbox.min.z }
  return size.z >= 25 && size.z > size.x && size.z > size.y
}

export const componentsVisual = (ids: number[]): RuleVisual => ({ kind: 'components', ids })
