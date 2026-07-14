import * as THREE from 'three'

/**
 * Showcase car for the cinematic landing — a sleeker, higher-detail cousin of
 * the analysis sample car. Purely visual; never enters the analysis pipeline.
 * Canonical frame: X longitudinal (nose +X), Y up, Z lateral, mm scale.
 */

const CARBON = new THREE.MeshPhysicalMaterial({
  color: 0x0d0d11,
  metalness: 0.55,
  roughness: 0.32,
  clearcoat: 1.0,
  clearcoatRoughness: 0.18,
})

const RED = new THREE.MeshPhysicalMaterial({
  color: 0x9d0f14,
  metalness: 0.6,
  roughness: 0.26,
  clearcoat: 1.0,
  clearcoatRoughness: 0.12,
})

const DARK_METAL = new THREE.MeshStandardMaterial({
  color: 0x2a2a30,
  metalness: 0.9,
  roughness: 0.35,
})

const TIRE = new THREE.MeshStandardMaterial({
  color: 0x101013,
  metalness: 0.1,
  roughness: 0.85,
})

const RIM = new THREE.MeshStandardMaterial({
  color: 0x8a8f98,
  metalness: 1.0,
  roughness: 0.25,
})

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  return m
}

function wheel(x: number, z: number, width: number): THREE.Group {
  const g = new THREE.Group()
  const tire = new THREE.CylinderGeometry(15, 15, width, 48)
  tire.rotateX(Math.PI / 2)
  g.add(mesh(tire, TIRE))

  const rimOuter = new THREE.CylinderGeometry(9.5, 9.5, width + 0.4, 32)
  rimOuter.rotateX(Math.PI / 2)
  g.add(mesh(rimOuter, RIM))

  const hub = new THREE.CylinderGeometry(2.6, 2.6, width + 1.2, 16)
  hub.rotateX(Math.PI / 2)
  g.add(mesh(hub, DARK_METAL))

  // Spokes
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.BoxGeometry(1.6, 7.4, width + 0.6)
    const s = mesh(spoke, DARK_METAL, 0, 0, 0)
    s.rotation.z = (i / 5) * Math.PI * 2
    s.position.set(Math.sin((i / 5) * Math.PI * 2) * -3.4, Math.cos((i / 5) * Math.PI * 2) * 3.4, 0)
    g.add(s)
  }

  g.position.set(x, 15, z)
  return g
}

export function buildShowCar(): THREE.Group {
  const car = new THREE.Group()

  // ── Monocoque: sculpted profile via extruded side silhouette ──
  const profile = new THREE.Shape()
  profile.moveTo(-82, 9)
  profile.lineTo(-82, 26)
  profile.quadraticCurveTo(-60, 33, -32, 34)
  profile.quadraticCurveTo(-10, 35, 4, 30)
  profile.quadraticCurveTo(40, 21, 70, 15)
  profile.quadraticCurveTo(82, 12, 84, 10)
  profile.lineTo(84, 9)
  profile.closePath()
  const bodyGeo = new THREE.ExtrudeGeometry(profile, {
    depth: 30,
    bevelEnabled: true,
    bevelSize: 5,
    bevelThickness: 5,
    bevelSegments: 5,
  })
  bodyGeo.translate(0, 0, -15)
  car.add(mesh(bodyGeo, CARBON))

  // Engine cover spine
  const spine = new THREE.CapsuleGeometry(5.5, 46, 6, 14)
  spine.rotateZ(Math.PI / 2)
  car.add(mesh(spine, RED, -32, 34, 0))

  // Sidepods
  const podGeo = new THREE.BoxGeometry(58, 13, 9)
  const podL = mesh(podGeo, CARBON, -18, 15, 21)
  const podR = mesh(podGeo.clone(), CARBON, -18, 15, -21)
  podL.rotation.y = 0.06
  podR.rotation.y = -0.06
  car.add(podL, podR)

  // Cockpit + halo
  const cockpit = new THREE.SphereGeometry(9, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2)
  car.add(mesh(cockpit, DARK_METAL, 10, 30, 0))
  const halo = new THREE.TorusGeometry(10.5, 1.7, 10, 40, Math.PI)
  const haloMesh = mesh(halo, DARK_METAL, 10, 32, 0)
  haloMesh.rotation.z = -0.12
  car.add(haloMesh)
  const haloPost = new THREE.CylinderGeometry(1.5, 1.9, 12, 10)
  car.add(mesh(haloPost, DARK_METAL, 18, 36, 0))

  // Nose cone
  const nose = new THREE.ConeGeometry(7.5, 36, 24)
  nose.rotateZ(-Math.PI / 2)
  car.add(mesh(nose, RED, 100, 13, 0))

  // ── Front wing assembly ──
  const fwMain = new THREE.BoxGeometry(19, 3.2, 64)
  const fw = mesh(fwMain, CARBON, 99, 7, 0)
  car.add(fw)
  const fwFlap = new THREE.BoxGeometry(10, 2.4, 58)
  const flap = mesh(fwFlap, RED, 93, 10.5, 0)
  flap.rotation.z = 0.28
  car.add(flap)
  const fwPlate = new THREE.BoxGeometry(21, 13, 2)
  car.add(mesh(fwPlate, CARBON, 99, 11, 33))
  car.add(mesh(fwPlate.clone(), CARBON, 99, 11, -33))
  const pylon = new THREE.BoxGeometry(12, 7, 7)
  car.add(mesh(pylon, CARBON, 95, 12, 0))

  // ── Rear wing assembly ──
  const rwMain = new THREE.BoxGeometry(17, 3.4, 62)
  const rw = mesh(rwMain, CARBON, -94, 57, 0)
  rw.rotation.z = -0.16
  car.add(rw)
  const rwFlap = new THREE.BoxGeometry(9, 2.6, 62)
  const rflap = mesh(rwFlap, RED, -100, 62, 0)
  rflap.rotation.z = -0.42
  car.add(rflap)
  const rwPlate = new THREE.BoxGeometry(26, 24, 2)
  car.add(mesh(rwPlate, CARBON, -95, 52, 32))
  car.add(mesh(rwPlate.clone(), CARBON, -95, 52, -32))
  const support = new THREE.BoxGeometry(7, 30, 3.4)
  const supL = mesh(support, DARK_METAL, -88, 40, 12)
  const supR = mesh(support.clone(), DARK_METAL, -88, 40, -12)
  supL.rotation.z = 0.1
  supR.rotation.z = 0.1
  car.add(supL, supR)

  // Diffuser hint
  const diff = new THREE.BoxGeometry(16, 6, 34)
  const diffuser = mesh(diff, DARK_METAL, -84, 8, 0)
  diffuser.rotation.z = 0.22
  car.add(diffuser)

  // ── Wheels + suspension ──
  car.add(wheel(66, 27, 14), wheel(66, -27, 14), wheel(-64, 25, 18), wheel(-64, -25, 18))
  const armGeo = new THREE.CylinderGeometry(1.2, 1.2, 22, 8)
  armGeo.rotateX(Math.PI / 2)
  for (const [x, z] of [
    [66, 14],
    [66, -14],
    [-64, 12],
    [-64, -12],
  ] as const) {
    const arm = mesh(armGeo.clone(), DARK_METAL, x, 16, z)
    arm.rotation.x = z > 0 ? 0.12 : -0.12
    car.add(arm)
  }

  return car
}
