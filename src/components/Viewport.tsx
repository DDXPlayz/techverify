import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { SceneManager } from '../viewport/SceneManager'
import { buildOverlays, STATUS_COLORS } from '../viewport/overlays'
import { useStore } from '../state/store'
import type { RuleVisual } from '../types/rules'

const BASE_MATERIAL = new THREE.MeshPhysicalMaterial({
  color: 0x3a3a44,
  metalness: 0.55,
  roughness: 0.38,
  clearcoat: 0.5,
  clearcoatRoughness: 0.22,
})
const DIM_MATERIAL = new THREE.MeshPhysicalMaterial({
  color: 0x131317,
  metalness: 0.5,
  roughness: 0.6,
  transparent: true,
  opacity: 0.35,
})

function highlightMaterial(color: number): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color).multiplyScalar(0.28),
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.5,
    metalness: 0.4,
    roughness: 0.4,
  })
}

/** Default overview dimensions shown when no rule is selected. */
function overviewVisuals(): RuleVisual[] {
  const a = useStore.getState().model?.analysis
  if (!a) return []
  const { bbox } = a
  return [
    {
      kind: 'dimension',
      a: [bbox.min.x, 0, bbox.max.z + 14],
      b: [bbox.max.x, 0, bbox.max.z + 14],
      label: `L ${a.overallLength.toFixed(1)} mm`,
    },
    {
      kind: 'dimension',
      a: [bbox.max.x + 14, 0, bbox.min.z],
      b: [bbox.max.x + 14, 0, bbox.max.z],
      label: `W ${a.overallWidth.toFixed(1)} mm`,
    },
    {
      kind: 'dimension',
      a: [bbox.min.x - 14, 0, bbox.min.z - 8],
      b: [bbox.min.x - 14, bbox.max.y, bbox.min.z - 8],
      label: `H ${a.overallHeight.toFixed(1)} mm`,
    },
  ]
}

export function Viewport() {
  const containerRef = useRef<HTMLDivElement>(null)
  const managerRef = useRef<SceneManager | null>(null)
  const model = useStore((s) => s.model)
  const report = useStore((s) => s.report)
  const selectedRuleId = useStore((s) => s.selectedRuleId)

  useEffect(() => {
    if (!containerRef.current) return
    const manager = new SceneManager(containerRef.current)
    managerRef.current = manager
    return () => {
      manager.dispose()
      managerRef.current = null
    }
  }, [])

  // Mount the model
  useEffect(() => {
    const manager = managerRef.current
    if (!manager || !model) return
    model.object.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) (node as THREE.Mesh).material = BASE_MATERIAL
    })
    manager.setModel(model.object)

    const a = model.analysis
    const dist = Math.max(a.overallLength, a.overallWidth) * 1.9
    manager.flyTo(
      { position: [dist * 0.62, dist * 0.42, dist * 0.72], lookAt: [0, a.overallHeight / 2, 0] },
      1400,
    )
  }, [model])

  // Selected rule → overlays, highlights, camera flight
  useEffect(() => {
    const manager = managerRef.current
    if (!manager || !model || !report) return
    const a = model.analysis

    manager.overlayRoot.clear()

    const result = report.results.find((r) => r.ruleId === selectedRuleId)
    const visuals = result ? result.visuals : overviewVisuals()
    const status = result?.status ?? 'pass'
    const { group, highlightIds } = buildOverlays(visuals, status, a)
    manager.overlayRoot.add(group)

    // Repaint components: highlighted glow in status colour, rest dim slightly
    const hasHighlights = highlightIds.size > 0
    const glow = hasHighlights ? highlightMaterial(STATUS_COLORS[status]) : null
    model.object.traverse((node) => {
      if (!(node as THREE.Mesh).isMesh) return
      const mesh = node as THREE.Mesh
      const id = mesh.userData.componentId as number | undefined
      if (hasHighlights && id !== undefined && highlightIds.has(id)) mesh.material = glow!
      else mesh.material = hasHighlights ? DIM_MATERIAL : BASE_MATERIAL
    })

    if (result?.camera) {
      manager.flyTo(result.camera)
    } else if (!result) {
      const dist = Math.max(a.overallLength, a.overallWidth) * 1.9
      manager.flyTo({ position: [dist * 0.62, dist * 0.42, dist * 0.72], lookAt: [0, a.overallHeight / 2, 0] })
    }
  }, [selectedRuleId, model, report])

  return <div className="viewport" ref={containerRef} />
}
