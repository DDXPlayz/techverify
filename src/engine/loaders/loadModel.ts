import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'

export class ModelLoadError extends Error {
  readonly cause2: string
  readonly suggestion: string
  constructor(message: string, suggestion: string) {
    super(message)
    this.name = 'ModelLoadError'
    this.cause2 = message
    this.suggestion = suggestion
  }
}

export type SupportedFormat = 'glb' | 'gltf' | 'obj' | 'stl'

export function detectFormat(fileName: string): SupportedFormat {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (ext === 'glb' || ext === 'gltf' || ext === 'obj' || ext === 'stl') return ext
  throw new ModelLoadError(
    `Unsupported file type ".${ext}"`,
    'Export your model as GLB, GLTF, OBJ or STL and upload again.',
  )
}

/**
 * Parse a model file into a raw THREE.Group.
 * Materials are discarded downstream — only geometry matters for verification.
 */
export async function parseModelFile(file: File): Promise<{ object: THREE.Group; format: SupportedFormat }> {
  const format = detectFormat(file.name)
  const buffer = await file.arrayBuffer()
  if (buffer.byteLength === 0) {
    throw new ModelLoadError('The file is empty.', 'Re-export the model from your CAD software.')
  }

  try {
    switch (format) {
      case 'glb':
      case 'gltf': {
        const loader = new GLTFLoader()
        const gltf = await loader.parseAsync(buffer, '')
        return { object: gltf.scene, format }
      }
      case 'obj': {
        const text = new TextDecoder().decode(buffer)
        const obj = new OBJLoader().parse(text)
        return { object: obj, format }
      }
      case 'stl': {
        const geometry = new STLLoader().parse(buffer)
        const mesh = new THREE.Mesh(geometry)
        const group = new THREE.Group()
        group.add(mesh)
        return { object: group, format }
      }
    }
  } catch (err) {
    if (err instanceof ModelLoadError) throw err
    throw new ModelLoadError(
      `The file could not be parsed as ${format.toUpperCase()} (${err instanceof Error ? err.message : 'unknown error'}).`,
      'The file may be corrupted. Re-export it from your CAD software and try again.',
    )
  }
}

/** Bake world transforms and collect every mesh geometry in the group. */
export function collectBakedGeometries(object: THREE.Object3D): THREE.BufferGeometry[] {
  object.updateWorldMatrix(true, true)
  const out: THREE.BufferGeometry[] = []
  object.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) {
      const mesh = node as THREE.Mesh
      const geo = mesh.geometry.clone()
      geo.applyMatrix4(mesh.matrixWorld)
      // Drop everything except positions — deterministic, geometry-only analysis
      for (const key of Object.keys(geo.attributes)) {
        if (key !== 'position') geo.deleteAttribute(key)
      }
      out.push(geo.toNonIndexed ? (geo.index ? geo.toNonIndexed() : geo) : geo)
    }
  })
  if (out.length === 0) {
    throw new ModelLoadError('No mesh geometry found in the file.', 'Ensure the export contains at least one solid body.')
  }
  return out
}
