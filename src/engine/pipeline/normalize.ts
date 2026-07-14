import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { surfaceCentroid } from '../geometry/measure'
import type { NormalizationInfo } from '../../types/vehicle'

/**
 * Normalize an arbitrary CAD export into the canonical frame:
 * X longitudinal (nose +X), Y up (track at y=0), Z lateral, units in mm.
 * Everything is deterministic; confidence reflects heuristic margins.
 */

export interface NormalizeResult {
  /** Single merged geometry, canonical frame, mm */
  merged: THREE.BufferGeometry
  info: NormalizationInfo
  matrix: THREE.Matrix4
}

/** Expected proportions of a STEM Racing car (mm): L ~120–260, W 65–85, H ≤ 65 */
const TARGET_LENGTH = 190

const UNIT_CANDIDATES: { unit: NormalizationInfo['detectedUnit']; scale: number }[] = [
  { unit: 'mm', scale: 1 },
  { unit: 'cm', scale: 10 },
  { unit: 'in', scale: 25.4 },
  { unit: 'm', scale: 1000 },
]

/** Axis permutation matrices: map (long, up, lat) source axes onto (X, Y, Z). */
const AXES: THREE.Vector3[] = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, 0, 1),
]

export function normalizeGeometry(geometries: THREE.BufferGeometry[], format: string): NormalizeResult {
  const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false)
  if (!merged) throw new Error('Failed to merge geometries')

  merged.computeBoundingBox()
  const size = merged.boundingBox!.getSize(new THREE.Vector3())
  const extents = [size.x, size.y, size.z]

  // --- Axis assignment: longest = longitudinal, shortest = vertical ---
  const order = [0, 1, 2].sort((a, b) => extents[b] - extents[a]) // desc
  const longAxis = order[0]
  const latAxis = order[1]
  const upAxis = order[2]

  // Confidence from separation between the sorted extents
  const sep1 = extents[longAxis] > 0 ? 1 - extents[latAxis] / extents[longAxis] : 0
  const sep2 = extents[latAxis] > 0 ? 1 - extents[upAxis] / extents[latAxis] : 0
  const orientationConfidence = Math.max(0.2, Math.min(1, (sep1 + sep2) * 1.2))

  // Rotation: source longAxis→X, upAxis→Y, latAxis→Z (right-handed basis)
  const xNew = AXES[longAxis].clone()
  const yNew = AXES[upAxis].clone()
  let zNew = new THREE.Vector3().crossVectors(xNew, yNew)
  if (zNew.lengthSq() < 0.5) zNew = AXES[latAxis].clone()
  const basis = new THREE.Matrix4().makeBasis(xNew, yNew, zNew) // columns = new axes in old coords
  const rot = basis.clone().transpose() // inverse of orthonormal basis

  // --- Unit detection: length should land near TARGET_LENGTH mm ---
  const rawLength = extents[longAxis]
  let best = UNIT_CANDIDATES[0]
  let bestErr = Infinity
  for (const cand of UNIT_CANDIDATES) {
    const len = rawLength * cand.scale
    const err = Math.abs(Math.log(len / TARGET_LENGTH))
    if (err < bestErr) {
      bestErr = err
      best = cand
    }
  }
  const scaledLength = rawLength * best.scale
  const scaleConfidence = scaledLength > 80 && scaledLength < 400 ? Math.max(0.3, 1 - bestErr) : 0.25
  const detectedUnit: NormalizationInfo['detectedUnit'] =
    scaledLength > 80 && scaledLength < 400 ? best.unit : 'unknown'

  const matrix = new THREE.Matrix4()
    .makeScale(best.scale, best.scale, best.scale)
    .multiply(rot)
  merged.applyMatrix4(matrix)

  // --- Nose direction: the rear half carries the body mass (cartridge chamber) ---
  merged.computeBoundingBox()
  let bbox = merged.boundingBox!
  const centroid = surfaceCentroid(merged)
  const midX = (bbox.min.x + bbox.max.x) / 2
  let noseFlipped = false
  if (centroid.x < midX) {
    // heavier half is at -X → that's the rear → already nose +X? Centroid sits toward
    // the rear, so if centroid < mid the rear is at -X and the nose already points +X.
  } else {
    // centroid toward +X → rear is at +X → flip so nose points +X
    const flip = new THREE.Matrix4().makeRotationY(Math.PI)
    merged.applyMatrix4(flip)
    matrix.premultiply(flip)
    noseFlipped = true
    merged.computeBoundingBox()
    bbox = merged.boundingBox!
  }

  // --- Ground and centre: track plane y=0, centreline z=0, x centred ---
  const center = bbox.getCenter(new THREE.Vector3())
  const translate = new THREE.Matrix4().makeTranslation(-center.x, -bbox.min.y, -center.z)
  merged.applyMatrix4(translate)
  matrix.premultiply(translate)
  merged.computeBoundingBox()

  return {
    merged,
    matrix,
    info: {
      sourceFormat: format,
      detectedUnit,
      appliedScale: best.scale,
      axisMapping: `${'XYZ'[longAxis]}→length, ${'XYZ'[upAxis]}→height, ${'XYZ'[latAxis]}→width`,
      noseFlipped,
      upFlipped: false,
      orientationConfidence,
      scaleConfidence,
    },
  }
}
