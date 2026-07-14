import * as THREE from 'three'
import type { RuleVisual, RuleStatus } from '../types/rules'
import type { VehicleAnalysis } from '../types/vehicle'

/**
 * Builds transient overlay objects (dimension lines, reference planes,
 * highlighted components) for a selected rule result.
 * Blue is reserved for measurement overlays; status colours for highlights.
 */

export const STATUS_COLORS: Record<RuleStatus, number> = {
  pass: 0x2dd977,
  warning: 0xf5c542,
  fail: 0xff2e3f,
  manual: 0x8a8f98,
}

const MEASURE_BLUE = 0x4da3ff

function makeLabelSprite(text: string, color = '#dbe9ff'): THREE.Sprite {
  const pad = 14
  const fontSize = 34
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  ctx.font = `600 ${fontSize}px "SF Mono", ui-monospace, monospace`
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2
  const h = fontSize + pad * 2
  canvas.width = w * 2
  canvas.height = h * 2
  const c2 = canvas.getContext('2d')!
  c2.scale(2, 2)
  c2.fillStyle = 'rgba(8, 10, 14, 0.88)'
  c2.beginPath()
  c2.roundRect(0, 0, w, h, 8)
  c2.fill()
  c2.strokeStyle = 'rgba(77, 163, 255, 0.5)'
  c2.lineWidth = 1.5
  c2.stroke()
  c2.font = `600 ${fontSize}px "SF Mono", ui-monospace, monospace`
  c2.fillStyle = color
  c2.textBaseline = 'middle'
  c2.fillText(text, pad, h / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true })
  const sprite = new THREE.Sprite(material)
  const scale = 0.24
  sprite.scale.set(w * scale, h * scale, 1)
  sprite.renderOrder = 20
  return sprite
}

/** Dimension line with arrowheads, extension ticks and a value label. */
function buildDimension(
  a: THREE.Vector3,
  b: THREE.Vector3,
  label: string,
  offset: THREE.Vector3,
): THREE.Group {
  const group = new THREE.Group()
  const start = a.clone().add(offset)
  const end = b.clone().add(offset)
  const dir = end.clone().sub(start)
  const len = dir.length()
  dir.normalize()

  const mat = new THREE.LineBasicMaterial({ color: MEASURE_BLUE, transparent: true, opacity: 0.95, depthTest: false })

  const lineGeo = new THREE.BufferGeometry().setFromPoints([start, end])
  const line = new THREE.Line(lineGeo, mat)
  line.renderOrder = 10
  group.add(line)

  // Extension lines from geometry to the dimension line
  for (const [from, to] of [
    [a, start],
    [b, end],
  ] as const) {
    const g = new THREE.BufferGeometry().setFromPoints([from, to])
    const ext = new THREE.Line(
      g,
      new THREE.LineBasicMaterial({ color: MEASURE_BLUE, transparent: true, opacity: 0.35, depthTest: false }),
    )
    ext.renderOrder = 10
    group.add(ext)
  }

  // Arrowheads
  const headLen = Math.min(7, len * 0.18)
  for (const [tip, d] of [
    [start, dir.clone()],
    [end, dir.clone().negate()],
  ] as const) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(headLen * 0.32, headLen, 10),
      new THREE.MeshBasicMaterial({ color: MEASURE_BLUE, depthTest: false, transparent: true }),
    )
    cone.position.copy(tip.clone().add(d.clone().multiplyScalar(headLen / 2)))
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().negate())
    cone.renderOrder = 11
    group.add(cone)
  }

  const sprite = makeLabelSprite(label)
  sprite.position.copy(start.clone().add(end).multiplyScalar(0.5)).add(new THREE.Vector3(0, 7, 0))
  group.add(sprite)

  return group
}

function buildPlane(axis: 'x' | 'y' | 'z', position: number, label: string, analysis: VehicleAnalysis): THREE.Group {
  const group = new THREE.Group()
  const size = Math.max(analysis.overallLength, analysis.overallWidth) * 1.15

  const geo = new THREE.PlaneGeometry(size, axis === 'y' ? size : Math.max(90, analysis.overallHeight * 1.6))
  const mat = new THREE.MeshBasicMaterial({
    color: MEASURE_BLUE,
    transparent: true,
    opacity: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(geo, mat)

  if (axis === 'x') {
    mesh.rotation.y = Math.PI / 2
    mesh.position.set(position, Math.max(45, analysis.overallHeight * 0.8) / 1.2, 0)
  } else if (axis === 'y') {
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(0, position, 0)
  } else {
    mesh.position.set(0, Math.max(45, analysis.overallHeight * 0.8) / 1.2, position)
  }
  group.add(mesh)

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: MEASURE_BLUE, transparent: true, opacity: 0.55 }),
  )
  edges.position.copy(mesh.position)
  edges.rotation.copy(mesh.rotation)
  group.add(edges)

  const sprite = makeLabelSprite(label)
  sprite.position.copy(mesh.position).add(new THREE.Vector3(0, axis === 'y' ? 6 : geo.parameters.height / 2 + 8, 0))
  group.add(sprite)

  return group
}

function buildBox(min: THREE.Vector3, max: THREE.Vector3, label: string, color: number): THREE.Group {
  const group = new THREE.Group()
  const box = new THREE.Box3(min, max)
  const helper = new THREE.Box3Helper(box, color)
  ;(helper.material as THREE.LineBasicMaterial).transparent = true
  ;(helper.material as THREE.LineBasicMaterial).opacity = 0.9
  group.add(helper)
  const sprite = makeLabelSprite(label)
  const center = box.getCenter(new THREE.Vector3())
  sprite.position.set(center.x, max.y + 8, center.z)
  group.add(sprite)
  return group
}

export function buildOverlays(
  visuals: RuleVisual[],
  status: RuleStatus,
  analysis: VehicleAnalysis,
): { group: THREE.Group; highlightIds: Set<number> } {
  const group = new THREE.Group()
  const highlightIds = new Set<number>()

  for (const v of visuals) {
    switch (v.kind) {
      case 'dimension':
        group.add(
          buildDimension(
            new THREE.Vector3(...v.a),
            new THREE.Vector3(...v.b),
            v.label,
            new THREE.Vector3(...(v.offset ?? [0, 0, 0])),
          ),
        )
        break
      case 'plane':
        group.add(buildPlane(v.axis, v.position, v.label, analysis))
        break
      case 'box':
        group.add(buildBox(new THREE.Vector3(...v.min), new THREE.Vector3(...v.max), v.label, STATUS_COLORS[status]))
        break
      case 'components':
        for (const id of v.ids) highlightIds.add(id)
        break
    }
  }

  return { group, highlightIds }
}
