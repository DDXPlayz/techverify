import * as THREE from 'three'

/**
 * Canonical vehicle coordinate frame (after normalization):
 *   X — longitudinal, nose toward +X
 *   Y — vertical, track surface at y = 0
 *   Z — lateral
 * All linear values are millimetres, angles in degrees.
 */

export interface Component {
  id: number
  /** Welded, transform-baked geometry in the canonical frame */
  geometry: THREE.BufferGeometry
  name: string
  triangleCount: number
  bbox: THREE.Box3
  center: THREE.Vector3
  volume: number
  surfaceArea: number
}

export interface Wheel {
  componentId: number
  center: THREE.Vector3
  /** Diameter across the rolling surface */
  diameter: number
  /** Extent along the lateral (Z) axis */
  contactWidth: number
  /** Radius uniformity: std/mean of radial samples (lower is rounder) */
  roundness: number
  position: 'front-left' | 'front-right' | 'rear-left' | 'rear-right'
  /** Lowest point of the wheel above the track plane */
  groundGap: number
  /** Inner face Z (closest to centreline), outer face Z */
  innerZ: number
  outerZ: number
}

export interface Axle {
  x: number
  wheels: Wheel[]
  /** Innermost distance between opposing wheels */
  innerDistance: number | null
}

export interface ReferencePlanes {
  /** Reference plane A: 16 mm forward of front axle centreline (X value) */
  a: number | null
  /** Reference plane B: 16 mm rearward of rear axle centreline (X value) */
  b: number | null
  /** Vertical reference plane along the car centreline (Z value) */
  vertical: number
}

export interface MeshQuality {
  triangleCount: number
  vertexCount: number
  componentCount: number
  degenerateTriangles: number
  openEdges: number
  nonManifoldEdges: number
  duplicateVerticesWelded: number
  watertight: boolean
  qualityScore: number // 0..1
}

export interface NormalizationInfo {
  sourceFormat: string
  detectedUnit: 'mm' | 'cm' | 'm' | 'in' | 'unknown'
  appliedScale: number
  axisMapping: string
  noseFlipped: boolean
  /** True when the model was found upside-down and righted using wheel detection */
  upFlipped: boolean
  orientationConfidence: number // 0..1
  scaleConfidence: number // 0..1
}

export interface VehicleAnalysis {
  fileName: string
  normalization: NormalizationInfo

  /** Whole-car bounding box in the canonical frame */
  bbox: THREE.Box3
  overallLength: number
  overallWidth: number
  overallHeight: number

  totalVolume: number // mm^3
  totalSurfaceArea: number // mm^2
  centerOfGeometry: THREE.Vector3
  /** 0..1 — reflective symmetry about the vertical reference plane */
  symmetryScore: number

  components: Component[]
  wheels: Wheel[]
  frontAxle: Axle | null
  rearAxle: Axle | null
  wheelbase: number | null
  planes: ReferencePlanes

  /** Min Y of all non-wheel geometry (track clearance candidate) */
  bodyMinClearance: number | null
  /** Component ids classified as wheels */
  wheelComponentIds: Set<number>
  /** True when the model is a single fused mesh that could not be segmented */
  singleFusedMesh: boolean

  meshQuality: MeshQuality
  analysisTimeMs: number
  /** Welded vertex positions (canonical frame, mm) for deterministic vertex scans */
  weldedPositions: Float32Array
}

export interface LoadedModel {
  fileName: string
  format: string
  /** Scene graph for rendering (already normalized) */
  object: THREE.Group
  analysis: VehicleAnalysis
}
