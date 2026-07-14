import { motion } from 'framer-motion'
import { useStore } from '../state/store'
import type { AnalysisStage } from '../engine/pipeline/analyze'

const STAGES: { key: AnalysisStage; label: string }[] = [
  { key: 'parsing', label: 'Reading model file' },
  { key: 'validating', label: 'Validating geometry' },
  { key: 'normalizing', label: 'Normalising scale & orientation' },
  { key: 'segmenting', label: 'Isolating components' },
  { key: 'measuring', label: 'Measuring geometry' },
  { key: 'vehicle', label: 'Recognising vehicle structure' },
  { key: 'rules', label: 'Running regulation engine' },
]

export function ProgressOverlay() {
  const stage = useStore((s) => s.progressStage)
  const detail = useStore((s) => s.progressDetail)
  const activeIndex = STAGES.findIndex((s) => s.key === stage)

  return (
    <div className="progress-overlay">
      <motion.div
        className="progress-card"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="progress-title">
          <span className="progress-pulse" aria-hidden />
          Analysing
        </div>
        <ul className="progress-stages">
          {STAGES.map((s, i) => {
            const state = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'pending'
            return (
              <li key={s.key} className={`progress-stage ${state}`}>
                <span className="stage-marker" aria-hidden>
                  {state === 'done' ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6.5l2.5 2.5 4.5-5.5" stroke="#2dd977" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : null}
                </span>
                {s.label}
              </li>
            )
          })}
        </ul>
        <p className="progress-detail mono">{detail}</p>
      </motion.div>
    </div>
  )
}
