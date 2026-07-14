import * as THREE from 'three'

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _c = new THREE.Vector3()

function forEachTriangle(
  geometry: THREE.BufferGeometry,
  fn: (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => void,
) {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  const index = geometry.getIndex()
  const triCount = index ? index.count / 3 : pos.count / 3
  for (let t = 0; t < triCount; t++) {
    const i0 = index ? index.getX(t * 3) : t * 3
    const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1
    const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2
    _a.fromBufferAttribute(pos, i0)
    _b.fromBufferAttribute(pos, i1)
    _c.fromBufferAttribute(pos, i2)
    fn(_a, _b, _c)
  }
}

/** Signed volume via divergence theorem (exact for closed meshes). */
export function signedVolume(geometry: THREE.BufferGeometry): number {
  let vol = 0
  const cross = new THREE.Vector3()
  forEachTriangle(geometry, (a, b, c) => {
    vol += a.dot(cross.copy(b).cross(c)) / 6
  })
  return vol
}

export function surfaceArea(geometry: THREE.BufferGeometry): number {
  let area = 0
  const ab = new THREE.Vector3()
  const ac = new THREE.Vector3()
  forEachTriangle(geometry, (a, b, c) => {
    ab.subVectors(b, a)
    ac.subVectors(c, a)
    area += ab.cross(ac).length() / 2
  })
  return area
}

/** Area-weighted centroid of the surface — stable "centre of geometry". */
export function surfaceCentroid(geometry: THREE.BufferGeometry): THREE.Vector3 {
  const centroid = new THREE.Vector3()
  const tri = new THREE.Vector3()
  const ab = new THREE.Vector3()
  const ac = new THREE.Vector3()
  let total = 0
  forEachTriangle(geometry, (a, b, c) => {
    ab.subVectors(b, a)
    ac.subVectors(c, a)
    const area = ab.cross(ac).length() / 2
    tri.copy(a).add(b).add(c).divideScalar(3)
    centroid.addScaledVector(tri, area)
    total += area
  })
  return total > 0 ? centroid.divideScalar(total) : centroid
}

/**
 * Reflective symmetry about the plane z = zPlane.
 * Quantizes surface sample points and checks mirrored occupancy. 0..1.
 */
export function symmetryScore(positions: Float32Array, zPlane: number, cell = 1.5): number {
  const occupied = new Set<string>()
  const inv = 1 / cell
  const n = positions.length
  for (let i = 0; i < n; i += 3) {
    const key = `${Math.round(positions[i] * inv)},${Math.round(positions[i + 1] * inv)},${Math.round(
      (positions[i + 2] - zPlane) * inv,
    )}`
    occupied.add(key)
  }
  if (occupied.size === 0) return 0
  let matched = 0
  for (const key of occupied) {
    const [x, y, z] = key.split(',').map(Number)
    if (z === 0 || occupied.has(`${x},${y},${-z}`)) matched++
  }
  return matched / occupied.size
}

export interface EdgeStats {
  openEdges: number
  nonManifoldEdges: number
  degenerateTriangles: number
}

/** Edge topology over a welded index buffer. */
export function edgeStats(positions: Float32Array, index: Uint32Array): EdgeStats {
  const edgeUse = new Map<number, number>()
  let degenerate = 0
  const vCount = positions.length / 3

  const edgeKey = (a: number, b: number) => (a < b ? a * vCount + b : b * vCount + a)

  for (let t = 0; t < index.length; t += 3) {
    const i0 = index[t]
    const i1 = index[t + 1]
    const i2 = index[t + 2]
    if (i0 === i1 || i1 === i2 || i2 === i0) {
      degenerate++
      continue
    }
    for (const [a, b] of [
      [i0, i1],
      [i1, i2],
      [i2, i0],
    ]) {
      const k = edgeKey(a, b)
      edgeUse.set(k, (edgeUse.get(k) ?? 0) + 1)
    }
  }

  let open = 0
  let nonManifold = 0
  for (const count of edgeUse.values()) {
    if (count === 1) open++
    else if (count > 2) nonManifold++
  }
  return { openEdges: open, nonManifoldEdges: nonManifold, degenerateTriangles: degenerate }
}
