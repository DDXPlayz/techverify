import { motion } from 'framer-motion'
import type { Rule, RuleResult } from '../types/rules'
import { limitText } from '../regulations/helpers'

const STATUS_META = {
  pass: { label: 'Pass', className: 'status-pass' },
  warning: { label: 'Warning', className: 'status-warning' },
  fail: { label: 'Fail', className: 'status-fail' },
  manual: { label: 'Manual check', className: 'status-manual' },
} as const

export function RuleCard({
  rule,
  result,
  selected,
  onSelect,
  index,
}: {
  rule: Rule
  result: RuleResult
  selected: boolean
  onSelect: () => void
  index: number
}) {
  const meta = STATUS_META[result.status]

  return (
    <motion.button
      className={`rule-card ${meta.className} ${selected ? 'selected' : ''}`}
      onClick={onSelect}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
        e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
      }}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.04, 0.5), ease: [0.22, 1, 0.36, 1] }}
      aria-expanded={selected}
    >
      <div className="rule-card-head">
        <span className="rule-id mono">{rule.id}</span>
        <span className="rule-name">{rule.name}</span>
        <span className={`chip ${meta.className}`}>{meta.label}</span>
      </div>

      <div className="rule-card-metrics">
        {result.measuredLabel && (
          <span className="metric mono">
            <em>measured</em> {result.measuredLabel}
          </span>
        )}
        {rule.limit && (
          <span className="metric mono">
            <em>limit</em> {limitText(rule.limit)}
          </span>
        )}
        {result.penaltyPoints ? (
          <span className="metric mono penalty">
            <em>penalty</em> −{result.penaltyPoints} pts
          </span>
        ) : null}
      </div>

      {selected && (
        <motion.div
          className="rule-card-detail"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="rule-desc">{rule.description}</p>
          <p className="rule-explanation">{result.explanation}</p>
          {result.remedy && (
            <p className="rule-remedy">
              <strong>How to fix</strong> {result.remedy}
            </p>
          )}
          <div className="rule-footer mono">
            <span>{rule.classification}</span>
            <span>penalty: {rule.penalty}</span>
            <span>confidence {(result.confidence * 100).toFixed(0)}%</span>
          </div>
        </motion.div>
      )}
    </motion.button>
  )
}
