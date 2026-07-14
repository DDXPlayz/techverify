import * as THREE from 'three'
import { STLExporter } from 'three/addons/exporters/STLExporter.js'

/**
 * Procedural, regulation-compliant STEM Racing car.
 * Canonical frame: X longitudinal (nose +X), Y up, Z lateral, mm.
 * Used by the hero animation and the "sample car" flow — the sample is
 * exported to binary STL and pushed through the real analysis pipeline.
 */

export function buildSampleCar(): THREE.Group {
  const group = new THREE.Group()
  const add = (name: string, geo: THREE.BufferGeometry, x = 0, y = 0, z = 0, rot?: THREE.Euler) => {
    const mesh = new THREE.Mesh(geo)
    mesh.name = name
    mesh.position.set(x, y, z)
    if (rot) mesh.rotation.copy(rot)
    group.add(mesh)
    return mesh
  }

  // Body: tapered fuselage, 160 mm long, bottom at y = 8
  const bodyShape = new THREE.Shape()
  bodyShape.moveTo(-80, 8)
  bodyShape.lineTo(-80, 30)
  bodyShape.lineTo(-30, 34)
  bodyShape.lineTo(30, 30)
  bodyShape.lineTo(70, 18)
  bodyShape.lineTo(80, 12)
  bodyShape.lineTo(80, 8)
  bodyShape.closePath()
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: 36, bevelEnabled: true, bevelSize: 3, bevelThickness: 3, bevelSegments: 3 })
  bodyGeo.rotateX(0)
  bodyGeo.translate(0, 0, -18)
  // Extrude runs along +Z; shape XY is longitudinal-vertical — already correct.
  add('body', bodyGeo)

  // Nose cone
  const nose = new THREE.ConeGeometry(9, 34, 24)
  nose.rotateZ(-Math.PI / 2)
  add('nose', nose, 97, 14, 0)

  // Halo hoop above cockpit
  const halo = new THREE.TorusGeometry(11, 2.2, 12, 32, Math.PI)
  halo.rotateZ(0)
  add('halo', halo, 6, 34, 0, new THREE.Euler(0, 0, 0))

  // Wheels: Ø30; front width 14 @ x=65, rear width 18 @ x=-65
  const wheelFront = new THREE.CylinderGeometry(15, 15, 14, 48)
  wheelFront.rotateX(Math.PI / 2)
  const wheelRear = new THREE.CylinderGeometry(15, 15, 18, 48)
  wheelRear.rotateX(Math.PI / 2)
  add('wheel-fl', wheelFront.clone(), 65, 15, 26)
  add('wheel-fr', wheelFront.clone(), 65, 15, -26)
  add('wheel-rl', wheelRear.clone(), -65, 15, 24)
  add('wheel-rr', wheelRear.clone(), -65, 15, -24)

  // Axles (thin, inside wheel-diameter envelope; 1 mm shy of the wheel faces
  // so the wheels stay free-rotating, separable components)
  const axleF = new THREE.CylinderGeometry(2.5, 2.5, 36, 16)
  axleF.rotateX(Math.PI / 2)
  add('axle-front', axleF, 65, 15, 0)
  const axleR = new THREE.CylinderGeometry(2.5, 2.5, 28, 16)
  axleR.rotateX(Math.PI / 2)
  add('axle-rear', axleR, -65, 15, 0)

  // Front wing: span 60, chord 18, thickness 4, ahead of plane A (x = 81)
  const frontWing = new THREE.BoxGeometry(18, 4, 60)
  add('front-wing', frontWing, 96, 8, 0)
  // End plates
  const plateF = new THREE.BoxGeometry(20, 12, 2.5)
  add('front-endplate-l', plateF.clone(), 96, 12, 31)
  add('front-endplate-r', plateF.clone(), 96, 12, -31)
  // Wing pylon connecting nose to wing (within ±15 mm centreline, below 25 mm)
  const pylon = new THREE.BoxGeometry(14, 6, 8)
  add('front-pylon', pylon, 92, 12, 0)

  // Rear wing: span 60, chord 18, thickness 4, rear of plane B (x = -81), top ≤ 62
  const rearWing = new THREE.BoxGeometry(18, 4, 60)
  add('rear-wing', rearWing, -92, 56, 0)
  const plateR = new THREE.BoxGeometry(22, 22, 2.5)
  add('rear-endplate-l', plateR.clone(), -92, 50, 31)
  add('rear-endplate-r', plateR.clone(), -92, 50, -31)
  // Rear wing supports (reach from the body top into the wing underside)
  const support = new THREE.BoxGeometry(6, 30, 4)
  add('rear-support-l', support.clone(), -86, 40, 14)
  add('rear-support-r', support.clone(), -86, 40, -14)

  return group
}

/** Export the sample car as a binary STL File, ready for the standard pipeline. */
export function sampleCarFile(): File {
  const car = buildSampleCar()
  car.updateMatrixWorld(true)
  const exporter = new STLExporter()
  const data = exporter.parse(car, { binary: true }) as DataView
  return new File([data.buffer as ArrayBuffer], 'anantam-sample-car.stl', { type: 'model/stl' })
}
