import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { CinematicScene, CHAPTER_COUNT } from '../viewport/CinematicScene'
import { UploadZone } from './UploadZone'
import { Navbar } from '@anantam/ui'
import './landing.css'

const EASE = [0.22, 1, 0.36, 1] as const

interface Chapter {
  id: string
  index: string
  kicker: string
  title: string
  body: string
  align: 'left' | 'right' | 'center'
}

const CHAPTERS: Chapter[] = [
  {
    id: 'ch-precision',
    index: '01',
    kicker: 'PRECISION',
    title: 'Measured like scrutineers measure.',
    body: 'Every dimension is computed deterministically from your geometry. The same model produces the same numbers — to a tenth of a millimetre, every run.',
    align: 'left',
  },
  {
    id: 'ch-measure',
    index: '02',
    kicker: 'MEASUREMENTS',
    title: 'Thirty checks. Zero gauges.',
    body: 'Wheelbase, track widths, wing chords, overhangs, clearances — everything the judges reach for a gauge to verify, resolved instantly in the browser.',
    align: 'right',
  },
  {
    id: 'ch-planes',
    index: '03',
    kicker: 'REFERENCE PLANES',
    title: 'The invisible geometry of the rulebook.',
    body: 'Plane A. Plane B. The vertical reference. Tech Verify reconstructs them from your wheel axles — 16.0 mm forward, 16.0 mm rearward — and measures exactly as the regulations define.',
    align: 'left',
  },
  {
    id: 'ch-compliance',
    index: '04',
    kicker: 'COMPLIANCE',
    title: 'See the verdict on the car itself.',
    body: 'Pass, margin and failure zones render directly on your model. The camera flies to every issue — you see the problem before you read a number.',
    align: 'right',
  },
]

export function Landing() {
  const canvasRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<CinematicScene | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [chapterIdx, setChapterIdx] = useState(0)

  useEffect(() => {
    if (!canvasRef.current) return
    const scene = new CinematicScene(canvasRef.current)
    sceneRef.current = scene
    return () => {
      scene.dispose()
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      const p = max > 0 ? window.scrollY / max : 0
      sceneRef.current?.setScroll(p)
      setChapterIdx(Math.round(p * (CHAPTER_COUNT - 1)))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollToUpload = () =>
    document.getElementById('upload-finale')?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div className="landing" ref={scrollerRef}>
      {/* Persistent cinematic canvas */}
      <div className="stage" ref={canvasRef} aria-hidden />
      <div className="stage-vignette" aria-hidden />

      {/* Navigation */}
      <Navbar appTitle="Tech Verify" />

      {/* Chapter progress rail */}
      <div className="rail" aria-hidden>
        {Array.from({ length: CHAPTER_COUNT }, (_, i) => (
          <span key={i} className={`rail-dot ${i === chapterIdx ? 'active' : ''}`} />
        ))}
      </div>

      {/* ── Chapter 0: hero ── */}
      <header className="chapter chapter-hero">
        <div className="hero-copy">
          <motion.p
            className="hero-eyebrow mono"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 1, ease: EASE }}
          >
            STEM RACING · REGULATION INTELLIGENCE
          </motion.p>
          <h1 className="hero-title" aria-label="Every Millimetre Matters." style={{ fontFamily: 'Orbitron, sans-serif' }}>
            {['Every', 'Millimetre', 'Matters.'].map((word, i) => (
              <motion.span
                key={word}
                className={`hero-word ${i === 2 ? 'hero-red' : ''}`}
                initial={{ opacity: 0, y: 60, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ delay: 1.1 + i * 0.18, duration: 1.1, ease: EASE }}
              >
                {word}
              </motion.span>
            ))}
          </h1>
          <motion.p
            className="hero-sub"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.9, duration: 1, ease: EASE }}
          >
            Upload your car. Watch every regulation verified against your real geometry — in
            seconds, entirely in the browser.
          </motion.p>
          <motion.div
            className="hero-actions"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.2, duration: 1, ease: EASE }}
          >
            <button className="btn-primary" onClick={scrollToUpload}>
              Verify your car
            </button>
            <button
              className="btn-ghost"
              onClick={() => document.getElementById('ch-precision')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Experience the story
            </button>
          </motion.div>
        </div>
        <motion.div
          className="hero-hint mono"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3.2, duration: 1.4 }}
        >
          <span className="hint-line" />
          SCROLL
        </motion.div>
      </header>

      {/* ── Story chapters ── */}
      {CHAPTERS.map((ch) => (
        <section key={ch.id} id={ch.id} className={`chapter chapter-story align-${ch.align}`}>
          <motion.div
            className="story-card"
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: '-22%' }}
            transition={{ duration: 1, ease: EASE }}
          >
            <span className="story-index mono">{ch.index}</span>
            <span className="story-kicker mono">{ch.kicker}</span>
            <h2>{ch.title}</h2>
            <p>{ch.body}</p>
          </motion.div>
        </section>
      ))}

      {/* ── Upload finale ── */}
      <section id="upload-finale" className="chapter chapter-upload">
        <motion.div
          className="upload-stage"
          initial={{ opacity: 0, y: 70 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, margin: '-18%' }}
          transition={{ duration: 1.1, ease: EASE }}
        >
          <UploadZone />
        </motion.div>
        <footer className="footer">
          <span className="mono">ANANTAM ENGINEERING</span>
          <span>Runs entirely in your browser. Models never leave your device.</span>
        </footer>
      </section>
    </div>
  )
}
