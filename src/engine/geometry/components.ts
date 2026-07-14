import * as THREE from 'three'
import { signedVolume, surfaceArea } from './measure'
import type { Component } from '../../types/vehicle'

/** Above this, connected-component segmentation is skipped to keep analysis fast. */
export const SEGMENTATION_TRIANGLE_CAP = 600_000

interface WeldResult {
  /** Position array (welded, x3 floats per vertex) */
  positions: Float32Array
  /** Index array into welded positions, 3 per triangle */
  index: Uint32Array
  duplicatesWelded: number
}

/**
 * Weld vertices by quantized position so topology (connectivity, edges)
 * can be analysed even on non-indexed STL soups. Deterministic.
 */
export function weldGeometry(geometry: THREE.BufferGeometry, tolerance = 1e-3): WeldResult {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  const srcIndex = geometry.getIndex()
  const vertCount = pos.count
  const inv = 1 / tolerance

  const map = new Map<string, number>()
  const remap = new Uint32Array(vertCount)
  const outPositions: number[] = []
  let welded = 0

  for (let i = 0; i < vertCount; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const key = `${Math.round(x * inv)},${Math.round(y * inv)},${Math.round(z * inv)}`
    let idx = map.get(key)
    if (idx === undefined) {
      idx = outPositions.length / 3
      map.set(key, idx)
      outPositions.push(x, y, z)
    } else {
      welded++
    }
    remap[i] = idx
  }

  const triCount = srcIndex ? srcIndex.count / 3 : vertCount / 3
  const index = new Uint32Array(triCount * 3)
  for (let t = 0; t < triCount * 3; t++) {
    const src = srcIndex ? srcIndex.getX(t) : t
    index[t] = remap[src]
  }

  return { positions: new Float32Array(outPositions), index, duplicatesWelded: welded }
}

/** Union–find over welded vertices → connected components of triangles. */
export function connectedComponents(weld: WeldResult): Uint32Array[] {
  const vCount = weld.positions.length / 3
  const parent = new Uint32Array(vCount)
  for (let i = 0; i < vCount; i++) parent[i] = i

  const find = (i: number): number => {
    let root = i
    while (parent[root] !== root) root = parent[root]
    while (parent[i] !== root) {
      const next = parent[i]
      parent[i] = root
      i = next
    }
    return root
  }
  const union = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[rb] = ra
  }

  const idx = weld.index
  for (let t = 0; t < idx.length; t += 3) {
    union(idx[t], idx[t + 1])
    union(idx[t + 2], idx[t])
  }

  const groups = new Map<number, number[]>()
  for (let t = 0; t < idx.length; t += 3) {
    const root = find(idx[t])
    let arr = groups.get(root)
    if (!arr) {
      arr = []
      groups.set(root, arr)
    }
    arr.push(t / 3)
  }

  return [...groups.values()].map((tris) => Uint32Array.from(tris))
}

/** Build a standalone BufferGeometry for a triangle subset of a welded mesh. */
export function extractComponentGeometry(weld: WeldResult, triangles: Uint32Array): THREE.BufferGeometry {
  const positions = new Float32Array(triangles.length * 9)
  let o = 0
  for (const t of triangles) {
    for (let c = 0; c < 3; c++) {
      const v = weld.index[t * 3 + c] * 3
      positions[o++] = weld.positions[v]
      positions[o++] = weld.positions[v + 1]
      positions[o++] = weld.positions[v + 2]
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.computeVertexNormals()
  return geo
}

/** Split a welded whole-car mesh into measured Components. */
export function buildComponents(weld: WeldResult): Component[] {
  const groups = connectedComponents(weld)
  // Deterministic order: largest first, then by centroid
  const comps: Component[] = groups.map((tris, i) => {
    const geometry = extractComponentGeometry(weld, tris)
    geometry.computeBoundingBox()
    const bbox = geometry.boundingBox!.clone()
    const center = bbox.getCenter(new THREE.Vector3())
    return {
      id: i,
      geometry,
      name: `component-${i}`,
      triangleCount: tris.length,
      bbox,
      center,
      volume: Math.abs(signedVolume(geometry)),
      surfaceArea: surfaceArea(geometry),
    }
  })
  comps.sort((a, b) => b.triangleCount - a.triangleCount || a.center.x - b.center.x)
  comps.forEach((c, i) => {
    c.id = i
    c.name = `component-${i}`
  })
  return comps
}
