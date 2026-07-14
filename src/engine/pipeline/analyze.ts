import * as THREE from 'three'
import { parseModelFile, collectBakedGeometries, ModelLoadError } from '../loaders/loadModel'
import { normalizeGeometry } from './normalize'
import {
  weldGeometry,
  buildComponents,
  SEGMENTATION_TRIANGLE_CAP,
} from '../geometry/components'
import { signedVolume, surfaceArea, surfaceCentroid, symmetryScore, edgeStats } from '../geometry/measure'
import { detectWheels } from '../vehicle/detectWheels'
import type { VehicleAnalysis, LoadedModel, MeshQuality } from '../../types/vehicle'

export type AnalysisStage =
  | 'parsing'
  | 'validating'
  | 'normalizing'
  | 'segmenting'
  | 'measuring'
  | 'vehicle'
  | 'rules'

export type ProgressCallback = (stage: AnalysisStage, detail: string) => void

// Yield a macrotask so the progress UI can paint between stages.
// (Not requestAnimationFrame — rAF throttles to ~1 fps in hidden tabs.)
const nextFrame = () => new Promise<void>((r) => setTimeout(r, 0))

/**
 * Full analysis pipeline:
 * parse → validate → normalize → segment → measure → vehicle recognition.
 * Deterministic; every derived value is traceable to mesh geometry.
 */
export async function analyzeModelFile(file: File, onProgress: ProgressCallback): Promise<LoadedModel> {
  const t0 = performance.now()

  onProgress('parsing', `Reading ${file.name}`)
  await nextFrame()
  const { object, format } = await parseModelFile(file)

  onProgress('validating', 'Extracting mesh geometry')
  await nextFrame()
  const geometries = collectBakedGeometries(object)
  const totalTris = geometries.reduce(
    (s, g) => s + (g.getIndex() ? g.getIndex()!.count : g.getAttribute('position').count) / 3,
    0,
  )
  if (totalTris < 4) {
    throw new ModelLoadError('The model contains almost no geometry.', 'Check the export settings in your CAD software.')
  }

  onProgress('normalizing', 'Detecting units, orientation and track plane')
  await nextFrame()
  const { merged, info } = normalizeGeometry(geometries, format)

  onProgress('segmenting', 'Welding vertices and isolating components')
  await nextFrame()
  const canSegment = totalTris <= SEGMENTATION_TRIANGLE_CAP
  let weld = weldGeometry(merged)
  let components = canSegment ? buildComponents(weld) : []
  let detection = detectWheels(components)

  // The axis mapper fixes which axis is vertical but not its sign. Wheels define
  // the track: if none were found, try the model upside-down and keep whichever
  // orientation an inspector could actually rest on its wheels.
  if (canSegment && detection.wheels.length !== 4) {
    onProgress('segmenting', 'No wheels at track level — testing inverted orientation')
    await nextFrame()
    const flipped = merged.clone()
    flipped.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI))
    flipped.computeBoundingBox()
    const fb = flipped.boundingBox!
    flipped.applyMatrix4(
      new THREE.Matrix4().makeTranslation(
        -(fb.min.x + fb.max.x) / 2,
        -fb.min.y,
        -(fb.min.z + fb.max.z) / 2,
      ),
    )
    const flippedWeld = weldGeometry(flipped)
    const flippedComponents = buildComponents(flippedWeld)
    const flippedDetection = detectWheels(flippedComponents)
    if (flippedDetection.wheels.length === 4) {
      merged.copy(flipped)
      merged.computeBoundingBox()
      weld = flippedWeld
      components = flippedComponents
      detection = flippedDetection
      info.upFlipped = true
    }
  }
  await nextFrame()

  onProgress('measuring', 'Computing volumes, areas and mesh quality')
  await nextFrame()
  merged.computeBoundingBox()
  const bbox = merged.boundingBox!.clone()
  const size = bbox.getSize(new THREE.Vector3())
  const stats = edgeStats(weld.positions, weld.index)
  const totalVolume = Math.abs(signedVolume(merged))
  const totalSurfaceArea = surfaceArea(merged)
  const centerOfGeometry = surfaceCentroid(merged)
  const symmetry = symmetryScore(weld.positions, 0)

  const vertexCount = weld.positions.length / 3
  const meshQuality: MeshQuality = {
    triangleCount: Math.round(totalTris),
    vertexCount,
    componentCount: components.length,
    degenerateTriangles: stats.degenerateTriangles,
    openEdges: stats.openEdges,
    nonManifoldEdges: stats.nonManifoldEdges,
    duplicateVerticesWelded: weld.duplicatesWelded,
    watertight: stats.openEdges === 0,
    qualityScore: Math.max(
      0,
      1 -
        stats.openEdges / Math.max(1, totalTris) -
        stats.nonManifoldEdges / Math.max(1, totalTris) -
        stats.degenerateTriangles / Math.max(1, totalTris),
    ),
  }

  onProgress('vehicle', 'Recognising wheels, axles and reference planes')
  await nextFrame()
  const wheelComponentIds = new Set(detection.wheels.map((w) => w.componentId))

  let bodyMinClearance: number | null = null
  if (detection.wheels.length === 4) {
    let minY = Infinity
    for (const c of components) {
      if (wheelComponentIds.has(c.id)) continue
      if (c.bbox.min.y < minY) minY = c.bbox.min.y
    }
    bodyMinClearance = Number.isFinite(minY) ? minY : null
  }

  const planes = {
    a: detection.frontAxle ? detection.frontAxle.x + 16 : null,
    b: detection.rearAxle ? detection.rearAxle.x - 16 : null,
    vertical: 0,
  }

  const analysis: VehicleAnalysis = {
    fileName: file.name,
    normalization: info,
    bbox,
    overallLength: size.x,
    overallWidth: size.z,
    overallHeight: size.y,
    totalVolume,
    totalSurfaceArea,
    centerOfGeometry,
    symmetryScore: symmetry,
    components,
    wheels: detection.wheels,
    frontAxle: detection.frontAxle,
    rearAxle: detection.rearAxle,
    wheelbase: detection.wheelbase,
    planes,
    bodyMinClearance,
    wheelComponentIds,
    singleFusedMesh: canSegment && components.length === 1,
    meshQuality,
    analysisTimeMs: performance.now() - t0,
    weldedPositions: weld.positions,
  }

  // Render object: the normalized merged mesh (single, canonical frame)
  const renderGroup = new THREE.Group()
  if (components.length > 1) {
    for (const c of components) {
      const mesh = new THREE.Mesh(c.geometry)
      mesh.name = c.name
      mesh.userData.componentId = c.id
      renderGroup.add(mesh)
    }
  } else {
    const geo = merged.clone()
    geo.computeVertexNormals()
    renderGroup.add(new THREE.Mesh(geo))
  }

  return { fileName: file.name, format, object: renderGroup, analysis }
}
