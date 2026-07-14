import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { Reflector } from 'three/addons/objects/Reflector.js'
import { buildShowCar } from './showCar'

/**
 * The cinematic landing scene. One persistent WebGL canvas drives the entire
 * scroll story: a keyframed camera path, per-chapter engineering overlays,
 * studio lighting, floor reflections, atmospheric particles, bloom, and a
 * keynote-style intro timeline.
 *
 * Chapters (scroll-normalised):
 *   0 hero · 1 precision · 2 measurements · 3 reference planes ·
 *   4 compliance · 5 upload finale
 */

export const CHAPTER_COUNT = 6

const BLUE = 0x4da3ff
const GREEN = 0x2dd977
const YELLOW = 0xf5c542
const RED = 0xff2e3f

interface CameraKey {
  pos: THREE.Vector3
  look: THREE.Vector3
  keyIntensity: number
  rimIntensity: number
}

const KEYS: CameraKey[] = [
  { pos: new THREE.Vector3(330, 112, 310), look: new THREE.Vector3(-42, 28, 72), keyIntensity: 3.0, rimIntensity: 0.6 },
  { pos: new THREE.Vector3(235, 58, 150), look: new THREE.Vector3(92, 14, 0), keyIntensity: 3.4, rimIntensity: 0.5 },
  { pos: new THREE.Vector3(35, 55, 335), look: new THREE.Vector3(0, 28, 0), keyIntensity: 3.0, rimIntensity: 0.7 },
  { pos: new THREE.Vector3(-215, 165, 235), look: new THREE.Vector3(0, 28, 0), keyIntensity: 2.6, rimIntensity: 0.9 },
  { pos: new THREE.Vector3(-310, 92, -220), look: new THREE.Vector3(-30, 30, 0), keyIntensity: 2.2, rimIntensity: 1.5 },
  { pos: new THREE.Vector3(330, 245, 385), look: new THREE.Vector3(0, 18, 0), keyIntensity: 1.6, rimIntensity: 0.4 },
]

const smooth = (t: number) => t * t * (3 - 2 * t)
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

function makeLabelSprite(text: string): THREE.Sprite {
  const pad = 12
  const fontSize = 30
  const canvas = document.createElement('canvas')
  const measure = canvas.getContext('2d')!
  measure.font = `600 ${fontSize}px "SF Mono", ui-monospace, monospace`
  const w = Math.ceil(measure.measureText(text).width) + pad * 2
  const h = fontSize + pad * 2
  canvas.width = w * 2
  canvas.height = h * 2
  const ctx = canvas.getContext('2d')!
  ctx.scale(2, 2)
  ctx.fillStyle = 'rgba(6, 8, 12, 0.82)'
  ctx.beginPath()
  ctx.roundRect(0, 0, w, h, 7)
  ctx.fill()
  ctx.strokeStyle = 'rgba(77, 163, 255, 0.45)'
  ctx.lineWidth = 1.4
  ctx.stroke()
  ctx.font = `600 ${fontSize}px "SF Mono", ui-monospace, monospace`
  ctx.fillStyle = '#d7e7ff'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, pad, h / 2)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }),
  )
  const scale = 0.22
  sprite.scale.set(w * scale, h * scale, 1)
  sprite.renderOrder = 30
  return sprite
}

function dimension(a: THREE.Vector3, b: THREE.Vector3, label: string, labelLift = 7): THREE.Group {
  const g = new THREE.Group()
  const mat = new THREE.LineBasicMaterial({ color: BLUE, transparent: true, opacity: 0.9, depthTest: false })
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), mat))
  const dir = b.clone().sub(a).normalize()
  const headLen = 6
  for (const [tip, d] of [
    [a, dir.clone()],
    [b, dir.clone().negate()],
  ] as const) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(1.9, headLen, 10),
      new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, depthTest: false }),
    )
    cone.position.copy(tip.clone().add(d.clone().multiplyScalar(headLen / 2)))
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().negate())
    cone.renderOrder = 29
    g.add(cone)
  }
  const s = makeLabelSprite(label)
  s.position.copy(a.clone().add(b).multiplyScalar(0.5)).add(new THREE.Vector3(0, labelLift, 0))
  g.add(s)
  return g
}

function refPlane(x: number, label: string): THREE.Group {
  const g = new THREE.Group()
  const geo = new THREE.PlaneGeometry(92, 84)
  const m = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }),
  )
  m.rotation.y = Math.PI / 2
  m.position.set(x, 38, 0)
  g.add(m)
  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: BLUE, transparent: true, opacity: 0.5 }),
  )
  edge.rotation.y = Math.PI / 2
  edge.position.copy(m.position)
  g.add(edge)
  const s = makeLabelSprite(label)
  s.position.set(x, 86, 0)
  g.add(s)
  return g
}

function zoneBox(min: THREE.Vector3, max: THREE.Vector3, color: number, label?: string): THREE.Group {
  const g = new THREE.Group()
  const box = new THREE.Box3(min, max)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const fill = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y, size.z),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, depthWrite: false }),
  )
  fill.position.copy(center)
  g.add(fill)
  const helper = new THREE.Box3Helper(box, color)
  ;(helper.material as THREE.LineBasicMaterial).transparent = true
  ;(helper.material as THREE.LineBasicMaterial).opacity = 0.85
  g.add(helper)
  if (label) {
    const s = makeLabelSprite(label)
    s.position.set(center.x, max.y + 9, center.z)
    g.add(s)
  }
  return g
}

export class CinematicScene {
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private composer: EffectComposer
  private bloom: UnrealBloomPass

  private carRig = new THREE.Group()
  private key: THREE.DirectionalLight
  private rim: THREE.DirectionalLight
  private particles: THREE.Points
  private chapters: THREE.Group[] = []

  private scroll = 0
  private pointer = new THREE.Vector2(0, 0)
  private pointerSmooth = new THREE.Vector2(0, 0)
  private startTime = performance.now()
  private disposed = false
  private visible = true
  private reducedMotion = false
  private resizeObserver: ResizeObserver
  private container: HTMLElement

  constructor(container: HTMLElement) {
    this.container = container
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 0.0
    container.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(36, container.clientWidth / container.clientHeight, 1, 6000)
    this.camera.position.copy(KEYS[0].pos)

    this.scene.background = new THREE.Color(0x060608)
    this.scene.fog = new THREE.FogExp2(0x060608, 0.0011)

    // Studio environment for paint reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.05).texture
    this.scene.environmentIntensity = 0.5

    // ── Lights ──
    this.key = new THREE.DirectionalLight(0xffffff, 3.0)
    this.key.position.set(190, 300, 170)
    const fill = new THREE.DirectionalLight(0xa9c4ff, 0.55)
    fill.position.set(-230, 140, -160)
    this.rim = new THREE.DirectionalLight(0xe10600, 0.6)
    this.rim.position.set(-140, 55, 240)
    const top = new THREE.SpotLight(0xffffff, 30000, 900, Math.PI / 5, 0.55, 1.6)
    top.position.set(0, 420, 60)
    top.target.position.set(0, 0, 0)
    this.scene.add(this.key, fill, this.rim, top, top.target, new THREE.AmbientLight(0x30303a, 0.9))

    // ── Floor: real planar reflection + soft carbon grid ──
    const reflector = new Reflector(new THREE.PlaneGeometry(2400, 2400), {
      textureWidth: 1024,
      textureHeight: 1024,
      color: 0x1c1c22,
      clipBias: 0.003,
    })
    reflector.rotation.x = -Math.PI / 2
    reflector.position.y = -0.12
    this.scene.add(reflector)

    // Matte veil over the mirror so it reads as polished concrete, not chrome
    const veil = new THREE.Mesh(
      new THREE.PlaneGeometry(2400, 2400),
      new THREE.MeshBasicMaterial({ color: 0x08080a, transparent: true, opacity: 0.78, depthWrite: false }),
    )
    veil.rotation.x = -Math.PI / 2
    veil.position.y = -0.06
    this.scene.add(veil)

    const grid = new THREE.GridHelper(2400, 120, 0x26262e, 0x17171c)
    ;(grid.material as THREE.Material).transparent = true
    ;(grid.material as THREE.Material).opacity = 0.4
    grid.position.y = 0.02
    this.scene.add(grid)

    // ── Car ──
    this.carRig.add(buildShowCar())
    this.scene.add(this.carRig)

    // ── Atmospheric particles ──
    const count = 420
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 1300
      positions[i * 3 + 1] = Math.random() * 420 + 8
      positions[i * 3 + 2] = (Math.random() - 0.5) * 1300
    }
    const pGeo = new THREE.BufferGeometry()
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.particles = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({
        color: 0x9db8e8,
        size: 1.6,
        transparent: true,
        opacity: 0.32,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    this.scene.add(this.particles)

    this.buildChapterOverlays()

    // ── Post: subtle bloom ──
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, container.clientHeight),
      0.32,
      0.7,
      0.82,
    )
    this.composer.addPass(this.bloom)
    this.composer.addPass(new OutputPass())

    this.resizeObserver = new ResizeObserver(() => this.onResize())
    this.resizeObserver.observe(container)

    window.addEventListener('pointermove', this.onPointerMove)
    document.addEventListener('visibilitychange', this.onVisibility)

    this.renderer.setAnimationLoop(() => this.tick())
  }

  /** Per-chapter overlay groups; opacity driven by scroll proximity. */
  private buildChapterOverlays() {
    for (let i = 0; i < CHAPTER_COUNT; i++) this.chapters.push(new THREE.Group())

    // 0 — hero: overall length dimension appears with the intro
    this.chapters[0].add(
      dimension(new THREE.Vector3(-110, 2, 66), new THREE.Vector3(110, 2, 66), 'L 210.0 mm', 9),
    )

    // 1 — precision: front wing span + ground clearance
    this.chapters[1].add(
      dimension(new THREE.Vector3(114, 18, -32), new THREE.Vector3(114, 18, 32), 'SPAN 64.0 mm', 8),
      dimension(new THREE.Vector3(128, 0, -20), new THREE.Vector3(128, 5.4, -20), 'CLR 5.4', 5),
    )

    // 2 — measurements: bounding box + wheelbase + height
    this.chapters[2].add(
      zoneBox(new THREE.Vector3(-112, 0, -34), new THREE.Vector3(112, 64, 34), BLUE),
      dimension(new THREE.Vector3(-64, 2, 74), new THREE.Vector3(66, 2, 74), 'WB 130.0 mm', 9),
      dimension(new THREE.Vector3(-124, 0, 0), new THREE.Vector3(-124, 64, 0), 'H 64.0 mm', 8),
    )

    // 3 — reference planes
    this.chapters[3].add(refPlane(82, 'REFERENCE PLANE A'), refPlane(-80, 'REFERENCE PLANE B'))
    const vertical = new THREE.Mesh(
      new THREE.PlaneGeometry(250, 84),
      new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false }),
    )
    vertical.position.set(0, 40, 0)
    this.chapters[3].add(vertical)

    // 4 — compliance zones
    this.chapters[4].add(
      zoneBox(new THREE.Vector3(86, 3, -35), new THREE.Vector3(114, 16, 35), GREEN, 'FRONT WING · PASS'),
      zoneBox(new THREE.Vector3(-108, 42, -34), new THREE.Vector3(-82, 68, 34), YELLOW, 'REAR WING · 0.8 mm MARGIN'),
      zoneBox(new THREE.Vector3(-79, 0, -34), new THREE.Vector3(81, 4, 34), RED, 'CLEARANCE · CHECK'),
    )

    for (const g of this.chapters) {
      this.setGroupOpacity(g, 0)
      this.scene.add(g)
    }
  }

  private setGroupOpacity(group: THREE.Group, k: number) {
    group.visible = k > 0.01
    group.traverse((node) => {
      const mat = (node as THREE.Mesh).material as THREE.Material & { opacity?: number } | undefined
      if (mat && 'opacity' in mat) {
        const base = (mat.userData.baseOpacity ??= mat.opacity ?? 1)
        mat.opacity = base * k
      }
    })
  }

  setScroll(progress: number) {
    this.scroll = THREE.MathUtils.clamp(progress, 0, 1)
  }

  private onPointerMove = (e: PointerEvent) => {
    this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1)
  }

  private onVisibility = () => {
    this.visible = document.visibilityState === 'visible'
  }

  private tick() {
    if (this.disposed || !this.visible) return
    const now = performance.now()
    const elapsed = (now - this.startTime) / 1000

    // ── Keynote intro: darkness → lights ramp → camera push (0–4.5 s) ──
    const intro = this.reducedMotion ? 1 : Math.min(1, elapsed / 4.5)
    const introK = easeOutCubic(intro)
    this.renderer.toneMappingExposure = 0.12 + introK * 1.0

    // ── Camera along the chapter path ──
    const t = this.scroll * (CHAPTER_COUNT - 1)
    const i = Math.min(CHAPTER_COUNT - 2, Math.floor(t))
    const f = smooth(THREE.MathUtils.clamp(t - i, 0, 1))
    const a = KEYS[i]
    const b = KEYS[i + 1]

    const pos = a.pos.clone().lerp(b.pos, f)
    const look = a.look.clone().lerp(b.look, f)

    // Intro push-in on the hero shot
    if (this.scroll < 0.02) {
      const push = 1.16 - introK * 0.16
      pos.multiplyScalar(push)
    }

    // Idle drift + mouse parallax
    this.pointerSmooth.lerp(this.pointer, 0.045)
    const drift = this.reducedMotion ? 0 : 1
    pos.x += Math.sin(elapsed * 0.14) * 6 * drift + this.pointerSmooth.x * 14 * drift
    pos.y += Math.cos(elapsed * 0.11) * 3 * drift - this.pointerSmooth.y * 9 * drift
    pos.z += Math.cos(elapsed * 0.09) * 5 * drift

    this.camera.position.copy(pos)
    this.camera.lookAt(look)

    // Car: slow turntable on the hero, settles as story begins
    const spin = Math.max(0, 1 - this.scroll * 6)
    this.carRig.rotation.y = this.reducedMotion ? 0 : Math.sin(elapsed * 0.1) * 0.16 * spin

    // Lighting follows the story
    this.key.intensity = THREE.MathUtils.lerp(a.keyIntensity, b.keyIntensity, f) * (0.25 + introK * 0.75)
    this.rim.intensity = THREE.MathUtils.lerp(a.rimIntensity, b.rimIntensity, f) * introK

    // Chapter overlays: triangle falloff around each chapter index
    for (let c = 0; c < CHAPTER_COUNT; c++) {
      let w = THREE.MathUtils.clamp(1 - Math.abs(t - c) * 1.45, 0, 1)
      if (c === 0) {
        // hero overlays wait for the intro's final beat
        w *= THREE.MathUtils.clamp((elapsed - 2.6) / 1.4, 0, 1)
      }
      this.setGroupOpacity(this.chapters[c], smooth(w))
    }

    // Particles drift
    if (!this.reducedMotion) {
      this.particles.rotation.y = elapsed * 0.008
      this.particles.position.y = Math.sin(elapsed * 0.2) * 4
    }

    // Bloom eases off in the upload finale so UI stays crisp
    this.bloom.strength = 0.32 * (1 - smooth(THREE.MathUtils.clamp(t - 4, 0, 1)) * 0.5)

    this.composer.render()
  }

  private onResize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (!w || !h) return
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.composer.setSize(w, h)
  }

  dispose() {
    this.disposed = true
    this.renderer.setAnimationLoop(null)
    this.resizeObserver.disconnect()
    window.removeEventListener('pointermove', this.onPointerMove)
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
