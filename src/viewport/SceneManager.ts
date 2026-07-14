import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { CameraTarget } from '../types/rules'

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/**
 * Owns the WebGL scene for the analysis viewport: studio environment,
 * model presentation, and eased camera flights.
 */
export class SceneManager {
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer
  readonly controls: OrbitControls
  readonly modelRoot = new THREE.Group()
  readonly overlayRoot = new THREE.Group()

  private flight: {
    fromPos: THREE.Vector3
    toPos: THREE.Vector3
    fromTarget: THREE.Vector3
    toTarget: THREE.Vector3
    start: number
    duration: number
  } | null = null
  private disposed = false
  private resizeObserver: ResizeObserver
  private container: HTMLElement

  constructor(container: HTMLElement) {
    this.container = container
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.1
    container.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(38, container.clientWidth / container.clientHeight, 1, 5000)
    this.camera.position.set(220, 130, 260)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.06
    this.controls.maxDistance = 1200
    this.controls.minDistance = 40
    this.controls.target.set(0, 25, 0)

    this.buildEnvironment()
    this.scene.add(this.modelRoot, this.overlayRoot)

    this.resizeObserver = new ResizeObserver(() => this.onResize())
    this.resizeObserver.observe(container)

    this.renderer.setAnimationLoop(() => this.tick())
  }

  private buildEnvironment() {
    this.scene.fog = new THREE.FogExp2(0x0a0a0c, 0.00095)

    // Studio reflections on the model paintwork
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.05).texture
    this.scene.environmentIntensity = 0.45

    // Soft contact shadow under the car
    const shadowCanvas = document.createElement('canvas')
    shadowCanvas.width = shadowCanvas.height = 256
    const sctx = shadowCanvas.getContext('2d')!
    const grad = sctx.createRadialGradient(128, 128, 12, 128, 128, 126)
    grad.addColorStop(0, 'rgba(0,0,0,0.62)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    sctx.fillStyle = grad
    sctx.fillRect(0, 0, 256, 256)
    const shadowTex = new THREE.CanvasTexture(shadowCanvas)
    const contactShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(420, 260),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
    )
    contactShadow.rotation.x = -Math.PI / 2
    contactShadow.position.y = 0.01
    this.scene.add(contactShadow)

    const key = new THREE.DirectionalLight(0xffffff, 3.2)
    key.position.set(180, 260, 160)
    const fill = new THREE.DirectionalLight(0xbfd4ff, 1.1)
    fill.position.set(-200, 120, -140)
    const rim = new THREE.DirectionalLight(0xff2a2a, 0.45)
    rim.position.set(-60, 40, 260)
    const under = new THREE.DirectionalLight(0x8899bb, 0.5)
    under.position.set(0, 60, -260)
    const ambient = new THREE.AmbientLight(0x50505a, 1.6)
    this.scene.add(key, fill, rim, under, ambient)

    // Track surface — subtle carbon grid
    const grid = new THREE.GridHelper(1600, 80, 0x2a2a30, 0x1a1a1f)
    ;(grid.material as THREE.Material).transparent = true
    ;(grid.material as THREE.Material).opacity = 0.55
    grid.position.y = -0.01
    this.scene.add(grid)

    const groundGeo = new THREE.PlaneGeometry(1600, 1600)
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0c0c0e,
      roughness: 0.9,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85,
    })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.05
    this.scene.add(ground)
  }

  setModel(object: THREE.Object3D) {
    this.modelRoot.clear()
    this.modelRoot.add(object)
  }

  flyTo(target: CameraTarget, duration = 1100) {
    this.flight = {
      fromPos: this.camera.position.clone(),
      toPos: new THREE.Vector3(...target.position),
      fromTarget: this.controls.target.clone(),
      toTarget: new THREE.Vector3(...target.lookAt),
      start: performance.now(),
      duration,
    }
  }

  private tick() {
    if (this.disposed) return
    if (this.flight) {
      const { fromPos, toPos, fromTarget, toTarget, start, duration } = this.flight
      const t = Math.min(1, (performance.now() - start) / duration)
      const k = easeInOutCubic(t)
      this.camera.position.lerpVectors(fromPos, toPos, k)
      this.controls.target.lerpVectors(fromTarget, toTarget, k)
      if (t >= 1) this.flight = null
    }
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  private onResize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (w === 0 || h === 0) return
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  dispose() {
    this.disposed = true
    this.renderer.setAnimationLoop(null)
    this.resizeObserver.disconnect()
    this.controls.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
