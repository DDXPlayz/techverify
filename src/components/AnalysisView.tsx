import { motion } from 'framer-motion'
import { useStore } from '../state/store'
import { Viewport } from './Viewport'
import { ReportPanel } from './ReportPanel'
import './analysis.css'

export function AnalysisView() {
  const model = useStore((s) => s.model)
  const reset = useStore((s) => s.reset)
  const selectRule = useStore((s) => s.selectRule)
  const selectedRuleId = useStore((s) => s.selectedRuleId)

  if (!model) return null

  return (
    <motion.div
      className="analysis-view"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      <header className="analysis-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="brand" style={{ mixBlendMode: 'normal' }}>ANANTAM<span>.</span></div>
          <div className="brand-sub">Tech Verify</div>
        </div>
        <span className="analysis-file mono">{model.fileName}</span>
        <div className="analysis-actions">
          {selectedRuleId && (
            <button className="btn-ghost bar-btn" onClick={() => selectRule(null)}>
              Reset view
            </button>
          )}
          <button className="btn-primary bar-btn" onClick={reset}>
            New analysis
          </button>
        </div>
      </header>

      <div className="analysis-body">
        <Viewport />
        <ReportPanel />
      </div>
    </motion.div>
  )
}
