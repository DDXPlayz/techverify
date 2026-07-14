import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const R = 56
const CIRC = 2 * Math.PI * R

export function ScoreRing({ score, hasFail = false }: { score: number; hasFail?: boolean }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const duration = 1400
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / duration)
      const k = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(score * k))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [score])

  // A hard failure means the car is not race-legal — never show green.
  const color = hasFail ? 'var(--red-bright)' : score >= 85 ? 'var(--green)' : score >= 60 ? 'var(--yellow)' : 'var(--red-bright)'
  const glow = hasFail
    ? 'rgba(255,46,63,0.45)'
    : score >= 85
      ? 'rgba(45,217,119,0.45)'
      : score >= 60
        ? 'rgba(245,197,66,0.4)'
        : 'rgba(255,46,63,0.45)'

  return (
    <div className="score-ring" role="img" aria-label={`Compliance score ${score} out of 100${hasFail ? ', with failures' : ''}`}>
      <svg width="150" height="150" viewBox="0 0 150 150">
        <circle cx="75" cy="75" r={R} stroke="rgba(255,255,255,0.07)" strokeWidth="9" fill="none" />
        <motion.circle
          cx="75"
          cy="75"
          r={R}
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          fill="none"
          transform="rotate(-90 75 75)"
          strokeDasharray={CIRC}
          initial={{ strokeDashoffset: CIRC }}
          animate={{ strokeDashoffset: CIRC * (1 - score / 100) }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 12px ${glow})` }}
        />
      </svg>
      <div className="score-ring-value">
        <span className="mono score-number" style={hasFail ? { color: 'var(--red-bright)' } : undefined}>
          {display}
        </span>
        <span className="score-caption">{hasFail ? 'not race-legal' : 'compliance'}</span>
      </div>
    </div>
  )
}
